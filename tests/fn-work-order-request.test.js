import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../config.js';
import { buildFNWorkOrderRequestBody, postFNworkOrderRequest } from '../utils/FieldNation/postFNworkOrderRequest.js';

const url = 'https://app.fieldnation.com/workorders/19920297?source=email';
const orderTime = { start: '2026-09-10T08:00', end: '2026-09-10T13:00', latestStart: '2026-09-10T17:00' };

test('order 19920297 uses separate local date/time fields and five labor hours', () => {
    assert.deepEqual(buildFNWorkOrderRequestBody('19920297', orderTime, 5), {
        work_order_id: '19920297',
        eta: { start: { local: { date: '2026-09-10', time: '08:00:00' } }, hour_estimate: 5 },
    });
});

test('supported local inputs retain wall-clock time without timezone conversion', () => {
    for (const time of ['2026-11-01T01:30:15', { local: '2026-11-01T01:30:15' },
        { start: { date: '2026-11-01', time: '01:30:15' } },
        { local: { date: '2026-11-01', time: '01:30:15' } }]) {
        assert.deepEqual(buildFNWorkOrderRequestBody('1', time).eta.start.local,
            { date: '2026-11-01', time: '01:30:15' });
        assert.equal(buildFNWorkOrderRequestBody('1', time).eta.hour_estimate, CONFIG.TIME.DEFAULT_LABOR_HOURS);
    }
});

test('missing, invalid and timezone-bearing values cannot be sent as local ETA', () => {
    for (const time of [null, {}, '', '2026-02-30T08:00', '2026-13-01T08:00',
        '2026-09-10T24:00', '2026-09-10T08:60', '2026-09-10T08:00Z',
        '2026-09-10T08:00-04:00', { local: { date: '2026-09-10' } }]) {
        assert.throws(() => buildFNWorkOrderRequestBody('1', time, 5), /ETA start/);
    }
});

test('TEST_MODE prevents fetch and returns test telemetry', async (t) => {
    const originalMode = CONFIG.TEST_MODE;
    t.after(() => { CONFIG.TEST_MODE = originalMode; });
    CONFIG.TEST_MODE = true;
    const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('Network forbidden'); });
    const result = await postFNworkOrderRequest(url, orderTime, 5);
    assert.equal(result.status, 'test');
    assert.equal(result.requestBody.eta.start.local.time, '08:00:00');
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('POST serializes the corrected ETA and preserves API failure reporting', async (t) => {
    const originalMode = CONFIG.TEST_MODE;
    t.after(() => { CONFIG.TEST_MODE = originalMode; });
    // All network calls are intercepted before exercising the live request path.
    const calls = [];
    let ok = true;
    t.mock.method(globalThis, 'fetch', async (requestUrl, init) => {
        calls.push({ requestUrl, init });
        return { ok, status: ok ? 200 : 400, text: async () => ok ? '{"id":123}' : 'invalid ETA' };
    });
    CONFIG.TEST_MODE = false;
    assert.equal(await postFNworkOrderRequest(url, orderTime, 5), '{"id":123}');
    assert.match(calls[0].requestUrl, /\/workorders\/19920297\/requests\?/);
    assert.equal(calls[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].init.body), buildFNWorkOrderRequestBody('19920297', orderTime, 5));
    ok = false;
    await assert.rejects(postFNworkOrderRequest(url, orderTime, 5), /FieldNation request failed \(400\): invalid ETA/);
    await assert.rejects(postFNworkOrderRequest(url, {}, 5), /ETA start/);
    assert.equal(calls.length, 2);
});
