import test from 'node:test';
import assert from 'node:assert/strict';
import normalizeDateFromWO from '../utils/normalizedDateFromWO.js';

test('WorkMarket PM schedule stays in the afternoon when only the end time has a timezone', () => {
  const order = normalizeDateFromWO({
    id: '4310269089',
    platform: 'WorkMarket',
    date: '2026-10-07',
    time: '1:00 PM to 4:00 PM EDT',
    hoursOfWork: 3,
  });

  assert.deepEqual(order.time, {
    start: '2026-10-07T13:00',
    end: '2026-10-07T16:00',
  });
});

test('AM/PM and timezone parsing handles noon, midnight, and latest start', () => {
  const noon = normalizeDateFromWO({
    date: '2026-10-07',
    time: '12:00 PM EDT',
    latestStartTime: '1:00 PM EDT',
    hoursOfWork: 1,
  });
  const midnight = normalizeDateFromWO({
    date: '2026-10-07',
    time: '12:00 AM',
    hoursOfWork: 1,
  });

  assert.equal(noon.time.start, '2026-10-07T12:00');
  assert.equal(noon.time.latestStart, '2026-10-07T13:00');
  assert.equal(midnight.time.start, '2026-10-07T00:00');
});
