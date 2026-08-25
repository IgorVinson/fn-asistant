import test from "node:test";
import assert from "node:assert/strict";

import { buildFNCounterOfferRequestBody } from "../utils/FieldNation/postFNCounterOffer.js";
import {
  FNAuthError,
  getFNorderData,
  parseFNWorkOrder,
} from "../utils/FieldNation/getFNorderData.js";
import { calculateCounterOffer } from "../utils/isEligibleForApplication.js";
import normalizeDateFromWO from "../utils/normalizedDateFromWO.js";
import { CONFIG } from "../config.js";

// Blended ("combined") work order — first 4 hrs for $160, up to 2 more hrs at $40/hr.
const blendedPayStructure = {
  type: "blended",
  base: { units: 4, amount: 160 },
  additional: { units: 2, amount: 40 },
};

test("FieldNation work-order redirects are classified as expired authentication", async () => {
  await assert.rejects(
    getFNorderData(
      "https://app.fieldnation.com/workorders/19819430?t=ActionNewWorkOrder",
      {
        getCookieHeader: () => "FNSESS=test",
        fetch: async () => ({
          ok: true,
          status: 200,
          url: "https://app.fieldnation.com/workorders/tomorrow",
          text: async () => "<html>redirected</html>",
        }),
      }
    ),
    error => error instanceof FNAuthError && error.code === "FN_AUTH_EXPIRED"
  );
});

test("FieldNation cookie-loading failures are classified as expired authentication", async () => {
  await assert.rejects(
    getFNorderData("https://app.fieldnation.com/workorders/19819430", {
      getCookieHeader: () => {
        throw new Error("no cookies valid for the requested URL");
      },
    }),
    error => error instanceof FNAuthError && error.code === "FN_AUTH_EXPIRED"
  );
});

test("FieldNation orders with missing pay are safely normalized to zero pay", () => {
  const parsed = parseFNWorkOrder({
    id: 123,
    company: { name: "Example Buyer" },
    title: "Unavailable order",
    schedule: {
      est_labor_hours: 3,
      service_window: {
        start: { local: "2026-08-24T09:00:00" },
        end: { local: "2026-08-24T12:00:00" },
      },
    },
    coords: { distance: "17.9" },
  });

  assert.deepEqual(parsed.payRange, { min: 0, max: 0 });
  assert.equal(parsed.payType, "fixed");
  assert.equal(parsed.hourlyRate, 0);
  assert.equal(parsed.estLaborHours, 3);
  assert.equal(parsed.distance, 17);
});

test("normalization identifies unavailable orders with no schedule date", () => {
  assert.throws(
    () =>
      normalizeDateFromWO({
        id: 123,
        platform: "WorkMarket",
        company: "Unavailable Buyer",
        title: "Unavailable order",
      }),
    error => error.code === "INVALID_WORK_ORDER_DATE"
  );
});

test("blended counter mirrors the work order pay structure exactly", () => {
  const body = buildFNCounterOfferRequestBody({
    workOrderId: 19264296,
    payType: "blended",
    payStructure: blendedPayStructure,
    travelExpense: 75,
    estLaborHours: 4,
    counterDate: null,
  });

  assert.equal(body.pay.type, "blended");
  assert.deepEqual(body.pay.base, { units: 4, amount: 160 });
  assert.deepEqual(body.pay.additional, { units: 2, amount: 40 });
});

test("counter date is sent via schedule.service_window with local date/time parts", () => {
  // 10:00 AM local — the slot the availability engine produced.
  const counterDate = {
    start: new Date(2026, 5, 5, 10, 0, 0),
    end: new Date(2026, 5, 5, 11, 0, 0),
    durationMinutes: 60,
  };

  const body = buildFNCounterOfferRequestBody({
    workOrderId: 19264296,
    payType: "blended",
    payStructure: blendedPayStructure,
    travelExpense: 75,
    estLaborHours: 4,
    counterDate,
  });

  // FieldNation counters carry the schedule here, NOT in an `eta` field.
  assert.ok(!body.eta, "counter must not use the apply-path `eta` field");
  assert.ok(body.schedule?.service_window, "schedule.service_window required");
  assert.equal(body.schedule.service_window.mode, "exact");
  assert.deepEqual(body.schedule.service_window.start.local, {
    date: "2026-06-05",
    time: "10:00:00",
  });
});

test("no schedule block is added when there is no counter date", () => {
  const body = buildFNCounterOfferRequestBody({
    workOrderId: 19264296,
    payType: "blended",
    payStructure: blendedPayStructure,
    travelExpense: 75,
    estLaborHours: 4,
    counterDate: null,
  });

  assert.ok(!body.schedule, "no schedule when no counter date");
});

test("travel expense is attached as an expense line", () => {
  const body = buildFNCounterOfferRequestBody({
    workOrderId: 19264296,
    payType: "blended",
    payStructure: blendedPayStructure,
    travelExpense: 75,
    estLaborHours: 4,
    counterDate: null,
  });

  assert.equal(body.expenses.length, 1);
  assert.equal(body.expenses[0].description, "travel");
  assert.equal(body.expenses[0].amount, 75);
});

test("blended counter keeps the shape but applies our FieldNation base rate", () => {
  const rate = CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION; // 65
  const co = calculateCounterOffer({
    platform: "FieldNation",
    payType: "blended",
    payStructure: blendedPayStructure, // $40/hr base + $40/hr additional
    payRange: { min: 160, max: 240 },
    hourlyRate: 0,
    estLaborHours: 4,
    distance: 47,
  });

  assert.equal(co.payType, "blended");
  // base.amount is a total for base.units hours; additional.amount is per-hour.
  assert.equal(co.payStructure.base.units, 4);
  assert.equal(co.payStructure.base.amount, rate * 4); // 260
  assert.equal(co.payStructure.additional.units, 2);
  assert.equal(co.payStructure.additional.amount, rate); // 65
});

test("hourly/fixed counters still build a base/additional pay block", () => {
  const body = buildFNCounterOfferRequestBody({
    workOrderId: 123,
    payType: "hourly",
    baseAmount: 65,
    baseHours: 4,
    travelExpense: 30,
    estLaborHours: 4,
    counterDate: null,
  });

  assert.equal(body.pay.type, "hourly");
  assert.equal(body.pay.base.amount, 65);
  assert.equal(body.pay.base.units, 4);
});
