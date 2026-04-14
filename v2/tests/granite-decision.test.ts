import test from "node:test";
import assert from "node:assert/strict";

import { defaultPolicy, type PolicySnapshot } from "../src/config/policy.js";
import { decideJob } from "../src/domain/decideJob.js";
import type { BusyInterval } from "../src/types/availability.js";
import type { NormalizedJob } from "../src/types/job.js";

function createJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: "wm:test-job",
    platform: "WorkMarket",
    company: "Granite Telecommunications",
    title: "Test Granite Job",
    requestedWindow: {
      earliestStart: "2026-05-04T09:00:00-04:00",
      latestStart: "2026-05-04T14:00:00-04:00",
      durationHours: 3,
      timezone: "America/New_York",
      requestedDate: "2026-05-04",
      isFlexible: true
    },
    compensation: {
      payType: "hourly",
      hourlyRate: 65,
      totalBudget: 195,
      minimumPay: 65,
      maximumPay: 195,
      estimatedHours: 3
    },
    distanceMiles: 10,
    companyNormalized: "granite telecommunications",
    sourceRef: {
      sourceKind: "replay",
      sourceId: "test",
      receivedAt: "2026-04-08T00:00:00.000Z"
    },
    tags: ["granite"],
    rawPayloadRef: "raw:test",
    ...overrides
  };
}

function createPolicy(overrides: Partial<PolicySnapshot> = {}): PolicySnapshot {
  return {
    ...defaultPolicy,
    ...overrides
  };
}

function createBusyInterval(overrides: Partial<BusyInterval> = {}): BusyInterval {
  return {
    start: "2026-05-04T09:45:00-04:00",
    end: "2026-05-04T10:45:00-04:00",
    label: "Existing job",
    ...overrides
  };
}

test("Granite eligible job applies when no counter dimensions are needed", () => {
  const job = createJob();
  const decision = decideJob(
    job,
    createPolicy({
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    })
  );

  assert.equal(decision.type, "apply");
  assert.equal(decision.reason, "ELIGIBLE");
});

test("Granite below minimum job skips before counter logic", () => {
  const job = createJob({
    compensation: {
      ...createJob().compensation,
      totalBudget: 90
    }
  });
  const decision = decideJob(job, createPolicy());

  assert.equal(decision.type, "skip");
  assert.equal(decision.reason, "PAYMENT_BELOW_MINIMUM");
});

test("Granite low-rate job counters rate and travel together", () => {
  const job = createJob({
    compensation: {
      ...createJob().compensation,
      hourlyRate: 50,
      totalBudget: 150
    },
    distanceMiles: 48.4
  });
  const decision = decideJob(job, createPolicy());

  assert.equal(decision.type, "counter_rate");
  assert.equal(decision.reason, "PAYMENT_INSUFFICIENT");
  assert.equal(decision.counterOffer?.hourlyRate, 65);
  assert.equal(decision.counterOffer?.travelExpense, 61);
});

test("Granite outside-hours job counters date when date countering is enabled", () => {
  const job = createJob({
    requestedWindow: {
      ...createJob().requestedWindow,
      earliestStart: "2026-05-04T08:00:00-04:00",
      latestStart: "2026-05-04T08:30:00-04:00"
    }
  });
  const decision = decideJob(
    job,
    createPolicy({
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    })
  );

  assert.equal(decision.type, "counter_date");
  assert.equal(decision.reason, "OUTSIDE_WORKING_HOURS");
  assert.equal(decision.executionPlan?.action, "counter");
  assert.equal(decision.counterOffer?.counterStart, "2026-05-04T09:00:00-04:00");
  assert.equal(decision.counterOffer?.counterEnd, "2026-05-04T12:00:00-04:00");
});

test("Granite outside-hours plus low-rate job becomes a combined counter", () => {
  const job = createJob({
    requestedWindow: {
      ...createJob().requestedWindow,
      earliestStart: "2026-05-04T08:00:00-04:00",
      latestStart: "2026-05-04T08:30:00-04:00"
    },
    compensation: {
      ...createJob().compensation,
      hourlyRate: 50,
      totalBudget: 150
    },
    distanceMiles: 48.4
  });
  const decision = decideJob(job, createPolicy());

  assert.equal(decision.type, "counter_both");
  assert.equal(decision.reason, "OUTSIDE_WORKING_HOURS");
  assert.equal(decision.counterOffer?.hourlyRate, 65);
  assert.equal(decision.counterOffer?.travelExpense, 61);
  assert.equal(decision.counterOffer?.counterStart, "2026-05-04T09:00:00-04:00");
  assert.equal(decision.counterOffer?.counterEnd, "2026-05-04T12:00:00-04:00");
});

test("Granite fixed slot with buffered calendar conflict counters to the next feasible slot", () => {
  const job = createJob({
    requestedWindow: {
      ...createJob().requestedWindow,
      earliestStart: "2026-05-04T09:00:00-04:00",
      latestStart: "2026-05-04T09:00:00-04:00",
      durationHours: 4,
      isFlexible: false
    }
  });
  const decision = decideJob(
    job,
    createPolicy({
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    }),
    {
      busyIntervals: [createBusyInterval()]
    }
  );

  assert.equal(decision.type, "counter_date");
  assert.equal(decision.reason, "SLOT_UNAVAILABLE");
  assert.equal(decision.counterOffer?.counterStart, "2026-05-04T11:15:00-04:00");
  assert.equal(decision.counterOffer?.counterEnd, "2026-05-04T15:15:00-04:00");
});

test("Granite late after-hours job counters to the next day when no same-day slot exists", () => {
  const job = createJob({
    requestedWindow: {
      ...createJob().requestedWindow,
      earliestStart: "2026-05-04T19:00:00-04:00",
      latestStart: "2026-05-04T19:00:00-04:00",
      durationHours: 3,
      isFlexible: false
    }
  });
  const decision = decideJob(
    job,
    createPolicy({
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    })
  );

  assert.equal(decision.type, "counter_date");
  assert.equal(decision.reason, "OUTSIDE_WORKING_HOURS");
  assert.equal(decision.counterOffer?.counterStart, "2026-05-05T09:00:00-04:00");
  assert.equal(decision.counterOffer?.counterEnd, "2026-05-05T12:00:00-04:00");
});

test("Non-Granite job is skipped when Granite-only mode is enabled", () => {
  const job = createJob({
    company: "Acme Telecom",
    companyNormalized: "acme telecom",
    title: "Routine voice dispatch",
    tags: ["workmarket"]
  });
  const decision = decideJob(job, createPolicy());

  assert.equal(decision.type, "skip");
  assert.equal(decision.reason, "POLICY_REJECTED");
});

test("Granite tags bypass exact company-name matching", () => {
  const job = createJob({
    company: "Pomeroy",
    companyNormalized: "pomeroy",
    title: "Router turn-up",
    tags: ["fieldnation", "granite"]
  });
  const decision = decideJob(
    job,
    createPolicy({
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    })
  );

  assert.equal(decision.type, "apply");
  assert.equal(decision.reason, "ELIGIBLE");
});
