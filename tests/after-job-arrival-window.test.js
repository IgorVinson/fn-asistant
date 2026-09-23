import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../config.js';
import { checkAvailabilityNew } from '../utils/isEligibleForApplication.js';
import { findFitBlock } from '../utils/availability/findFitBlock.js';
import { decideFitAction } from '../utils/availability/decideFitAction.js';
import { buildFNCounterOfferRequestBody, postFNCounterOffer } from '../utils/FieldNation/postFNCounterOffer.js';
import { buildWMCounterOfferFormData, postWMCounterOffer } from '../utils/WorkMarket/postWMCounterOffer.js';

const at = time => new Date(`2026-09-10T${time}:00`);
const busy = [{ start: at('09:00'), end: at('13:00') }];
function fit({ minutes = 90, events = busy, end = '20:00', latest = '13:00', preserve = false } = {}) {
  return findFitBlock([{ start: at('13:00'), end: at(end) }], {
    earliestStart: at('13:00'), latestStart: at(latest), durationMs: 4 * 3600000,
  }, 68, { busyBlocks: events, arrivalWindowMinutes: minutes, preserveRequestedWindow: preserve });
}

test('after a booking: reserve 90 minutes plus labor, with no extra travel estimate', () => {
  const result = fit();
  assert.equal(result.end.getTime(), at('18:30').getTime());
  assert.equal(result.effectiveDurationMinutes, 330);
  const decision = decideFitAction({ exactFit: result });
  assert.equal(decision.action, 'COUNTER_DATES');
  assert.equal(decision.counterDate.start.getTime(), at('13:00').getTime());
  assert.equal(decision.counterDate.end.getTime(), at('14:30').getTime());
  assert.equal(decision.counterDate.reason, 'arrival_window');
});

test('latest arrival plus labor must fit before next booking or workday end', () => {
  assert.equal(fit({ end: '18:29' }).fits, false);
  assert.equal(fit({ end: '18:30' }).fits, true);
  const result = findFitBlock([
    { start: at('13:00'), end: at('18:30') },
    { start: at('19:00'), end: at('20:00') },
  ], { earliestStart: at('13:00'), latestStart: at('13:00'), durationMs: 4 * 3600000 },
  68, { busyBlocks: busy, arrivalWindowMinutes: 90 });
  assert.equal(result.fits, true);
  assert.equal(result.effectiveDurationMinutes, 330);
});

test('first booking and disabled option keep existing travel and hard-start behavior', () => {
  for (const options of [{ events: [] }, { minutes: 0 }, { minutes: -1 }, { minutes: 'bad' },
    { events: [{ start: new Date('2026-09-09T09:00'), end: new Date('2026-09-09T13:00') }] },
    { events: [{ start: at('18:00'), end: at('19:00') }] }]) {
    const result = fit(options);
    assert.equal(result.arrivalWindowMinutes, 0);
    assert.equal(result.effectiveDurationMinutes, 308);
    assert.equal(decideFitAction({ exactFit: result }).action, 'APPLY');
  }
  assert.equal(fit({ minutes: 60 }).end.getTime(), at('18:00').getTime());
});

test('keep a buyer window only if the full arrival allowance fits inside it', () => {
  const wide = fit({ latest: '17:00', preserve: true });
  assert.equal(decideFitAction({ exactFit: wide, isRequestedWindow: true }).action, 'APPLY');
  const narrow = fit({ latest: '14:00', preserve: true });
  assert.equal(narrow.fits, false);
  const decision = decideFitAction({ exactFit: narrow, shiftedFit: fit(), isRequestedWindow: true });
  assert.equal(decision.counterDate.durationMinutes, 90);
});

test('FN and WM serialize the new window even when the original ticket was a hard start', () => {
  const { counterDate } = decideFitAction({ exactFit: fit() });
  const fn = buildFNCounterOfferRequestBody({ payType: 'hourly', baseAmount: 60,
    baseHours: 4, travelExpense: 85, counterDate });
  assert.equal(fn.schedule.service_window.mode, 'hours');
  assert.equal(fn.schedule.service_window.start.local.time, '13:00:00');
  assert.equal(fn.schedule.service_window.end.local.time, '14:30:00');
  assert.equal(fn.expenses[0].amount, 85);
  assert.doesNotMatch(fn.notes, /conflict/);
  const wm = buildWMCounterOfferFormData({ csrfToken: 'test', hourlyRate: 65, hours: 4,
    distance: 57, options: { counterDate, travelExpense: 85, isRequestedWindow: false } });
  assert.equal(wm.get('reschedule_option'), 'window');
  assert.ok(wm.get('totime'));
  assert.equal(wm.get('additional_expenses'), '85');
});

test('availability pipeline wires config, busy sources, and same-day/next-day fits', async () => {
  const saved = { TIME: CONFIG.TIME, STRATEGY: CONFIG.STRATEGY, IS_COUNTER_DAYS: CONFIG.IS_COUNTER_DAYS };
  try {
    CONFIG.TIME = { ...CONFIG.TIME, ARRIVAL_WINDOW_AFTER_JOB_MINUTES: 90, LATEST_COUNTER_START_TIME: '15:00' };
    CONFIG.STRATEGY = { ...CONFIG.STRATEGY, ENABLED: false };
    CONFIG.IS_COUNTER_DAYS = true;
    const order = { id: 1, platform: 'FieldNation', company: 'Test', estLaborHours: 4,
      distance: 57, time: { start: '2026-09-10T13:00', end: '2026-09-10T17:00' } };
    const result = await checkAvailabilityNew(order, async () => ({
      free: [{ start: at('13:00'), end: at('20:00') }], busy,
    }));
    assert.equal(result.fitDecision.counterDate.end.getTime(), at('14:30').getTime());
    const nextStart = new Date('2026-09-11T13:00');
    const next = await checkAvailabilityNew(order, async () => ({
      free: [{ start: nextStart, end: new Date('2026-09-11T20:00') }],
      busy: [{ start: new Date('2026-09-11T09:00'), end: nextStart }],
    }));
    assert.equal(next.fitDecision.counterDate.start.getTime(), nextStart.getTime());
    assert.equal(next.fitDecision.counterDate.durationMinutes, 90);
    CONFIG.TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES = 0;
    const disabled = await checkAvailabilityNew(order, async () => ({
      free: [{ start: at('13:00'), end: at('20:00') }], busy,
    }));
    assert.equal(disabled.fitDecision.action, 'APPLY');
  } finally { Object.assign(CONFIG, saved); }
});

test('TEST_MODE blocks FN and WM submissions before cookies or network access', async () => {
  const savedMode = CONFIG.TEST_MODE;
  const savedFetch = globalThis.fetch;
  try {
    CONFIG.TEST_MODE = true;
    globalThis.fetch = () => { throw new Error('Unexpected network call'); };
    const { counterDate } = decideFitAction({ exactFit: fit() });
    const fn = await postFNCounterOffer(1, { payType: 'hourly', baseAmount: 60, baseHours: 4, counterDate });
    const wm = await postWMCounterOffer(1, 65, 4, 57, { counterDate });
    assert.equal(fn.status, 'test');
    assert.equal(wm.status, 'test');
  } finally { CONFIG.TEST_MODE = savedMode; globalThis.fetch = savedFetch; }
});
