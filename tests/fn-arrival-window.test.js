import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFNWorkOrder } from '../utils/FieldNation/getFNorderData.js';
import normalizeDateFromWO from '../utils/normalizedDateFromWO.js';
import { findFitBlock } from '../utils/availability/findFitBlock.js';
import { decideFitAction } from '../utils/availability/decideFitAction.js';
import { buildFNCounterOfferRequestBody } from '../utils/FieldNation/postFNCounterOffer.js';

function order(mode = 'hours') {
  return normalizeDateFromWO(parseFNWorkOrder({
    id: 19915926,
    pay: { type: 'hourly', rate: { pay: 60 } },
    coords: { distance: 57 },
    schedule: {
      est_labor_hours: 4,
      service_window: {
        mode,
        start: { local: { date: '2026-09-10', time: '11:00:00' } },
        end: { local: { date: '2026-09-11', time: '17:00:00' } },
      },
    },
  }));
}

function fit(workOrder, start = '14:00') {
  return findFitBlock([{
    start: new Date(`2026-09-10T${start}:00`),
    end: new Date('2026-09-10T23:00:00'),
  }], {
    earliestStart: new Date(workOrder.time.start),
    latestStart: new Date(workOrder.time.latestStart || workOrder.time.start),
    durationMs: workOrder.estLaborHours * 3600000,
  }, 68);
}

test('FN 19915926: 14:00 fits 11–17 arrival hours without negotiating the schedule', () => {
  const workOrder = order();
  assert.equal(workOrder.isRequestedWindow, true);
  assert.equal(workOrder.time.latestStart, '2026-09-10T17:00');
  assert.equal(workOrder.time.end, '2026-09-10T15:00');
  const exactFit = fit(workOrder);
  assert.equal(exactFit.fits, true);
  const decision = decideFitAction({ exactFit });
  assert.equal(decision.action, 'APPLY');
  assert.equal(decision.counterDate, null);
  const body = buildFNCounterOfferRequestBody({
    payType: 'hourly', baseAmount: 60, baseHours: 4, travelExpense: 85,
    counterDate: decision.counterDate,
  });
  assert.equal(body.schedule, undefined);
  assert.equal(body.expenses[0].amount, 85);
  assert.doesNotMatch(body.notes, /scheduling conflict/);
});

test('FN daily arrival cutoff is inclusive and does not extend overnight', () => {
  assert.equal(fit(order(), '17:00').fits, true);
  assert.equal(fit(order(), '17:01').fits, false);
});

test('FN exact starts remain exact even when an end time is present', () => {
  const workOrder = order('exact');
  assert.equal(workOrder.isRequestedWindow, false);
  assert.equal(workOrder.time.latestStart, undefined);
  assert.equal(fit(workOrder).fits, false);
});

test('FN genuine window rescheduling serializes both arrival bounds', () => {
  const workOrder = order();
  const decision = decideFitAction({
    exactFit: { fits: false }, shiftedFit: fit(workOrder),
    requestedStart: new Date(workOrder.time.start),
    isRequestedWindow: true, requestedWindowMs: 6 * 3600000,
  });
  const body = buildFNCounterOfferRequestBody({
    payType: 'hourly', baseAmount: 60, baseHours: 4,
    counterDate: decision.counterDate,
  });
  assert.deepEqual(body.schedule.service_window, {
    mode: 'hours',
    start: { local: { date: '2026-09-10', time: '14:00:00' } },
    end: { local: { date: '2026-09-10', time: '20:00:00' } },
  });
});
