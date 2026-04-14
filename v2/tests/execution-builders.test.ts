import test from "node:test";
import assert from "node:assert/strict";

import { buildPlatformRequest } from "../src/execution/buildPlatformRequest.js";
import type { DecisionResult } from "../src/types/decision.js";
import type { NormalizedJob } from "../src/types/job.js";

function createWorkMarketJob(): NormalizedJob {
  return {
    id: "wm:8039965868",
    platform: "WorkMarket",
    platformWorkOrderId: "8039965868",
    company: "Granite Telecommunications",
    companyNormalized: "granite telecommunications",
    title: "Grid Tail Install",
    requestedWindow: {
      earliestStart: "2026-05-04T09:00:00-04:00",
      durationHours: 4,
      timezone: "America/New_York",
      requestedDate: "2026-05-04",
      isFlexible: false
    },
    compensation: {
      payType: "hourly",
      hourlyRate: 65,
      totalBudget: 260,
      estimatedHours: 4
    },
    distanceMiles: 35.5,
    sourceRef: {
      sourceKind: "replay",
      sourceId: "8039965868",
      receivedAt: "2026-04-08T00:00:00.000Z"
    },
    tags: ["granite"],
    rawPayloadRef: "8039965868"
  };
}

function createFieldNationJob(): NormalizedJob {
  return {
    id: "fn:18899424",
    platform: "FieldNation",
    platformWorkOrderId: "18899424",
    company: "TPX Communications",
    companyNormalized: "tpx communications",
    title: "Turn up circuits",
    requestedWindow: {
      earliestStart: "2026-04-14T09:45",
      durationHours: 3,
      timezone: "America/New_York",
      requestedDate: "2026-04-14",
      isFlexible: false
    },
    compensation: {
      payType: "hourly",
      hourlyRate: 65,
      totalBudget: 195,
      estimatedHours: 3
    },
    distanceMiles: 69,
    sourceRef: {
      sourceKind: "replay",
      sourceId: "18899424",
      receivedAt: "2026-04-08T00:00:00.000Z"
    },
    tags: ["fieldnation"],
    rawPayloadRef: "18899424"
  };
}

test("builds WorkMarket counter request with reschedule fields", () => {
  const decision: DecisionResult = {
    type: "counter_both",
    reason: "SLOT_UNAVAILABLE",
    trace: [],
    counterOffer: {
      hourlyRate: 65,
      travelExpense: 37,
      counterStart: "2026-05-04T11:15:00-04:00",
      counterEnd: "2026-05-04T15:15:00-04:00",
      note: "Counter date required"
    },
    executionPlan: {
      action: "counter",
      platform: "WorkMarket",
      payload: {}
    }
  };

  const request = buildPlatformRequest(createWorkMarketJob(), decision);

  assert.equal(request.platform, "WorkMarket");
  assert.equal(request.path, "/assignments/negotiate/8039965868");
  assert.equal(request.contentType, "application/x-www-form-urlencoded");
  assert.equal(request.body.per_hour_price, 65);
  assert.equal(request.body.additional_expenses, 37);
  assert.equal(request.body.schedule_negotiation, "on");
  assert.equal(request.body.from, "05/04/2026");
});

test("builds FieldNation counter request with travel and eta", () => {
  const decision: DecisionResult = {
    type: "counter_both",
    reason: "SLOT_UNAVAILABLE",
    trace: [],
    counterOffer: {
      hourlyRate: 65,
      travelExpense: 86,
      counterStart: "2026-04-15T09:00:00-04:00",
      note: "Counter date required"
    },
    executionPlan: {
      action: "counter",
      platform: "FieldNation",
      payload: {}
    }
  };

  const request = buildPlatformRequest(createFieldNationJob(), decision);

  assert.equal(request.platform, "FieldNation");
  assert.equal(
    request.path,
    "/v2/workorders/18899424/requests?acting_user_id=<user-id>&clientPayTermsAccepted=true"
  );
  assert.equal(request.contentType, "application/json");
  assert.equal(
    (request.body.pay as { base: { amount: number } }).base.amount,
    65
  );
  assert.equal(
    ((request.body.expenses as Array<{ amount: number }>)[0]).amount,
    86
  );
  assert.equal(
    (request.body.eta as { start: { local: string } }).start.local,
    "2026-04-15T09:00:00-04:00"
  );
});

test("builds apply request for WorkMarket", () => {
  const decision: DecisionResult = {
    type: "apply",
    reason: "ELIGIBLE",
    trace: [],
    executionPlan: {
      action: "apply",
      platform: "WorkMarket",
      payload: {}
    }
  };

  const request = buildPlatformRequest(createWorkMarketJob(), decision);

  assert.equal(request.path, "/assignments/apply/8039965868");
  assert.equal(request.body.isform, true);
});
