import test from "node:test";
import assert from "node:assert/strict";

import { evaluateJob } from "../src/app/evaluateJob.js";
import type { CalendarAvailabilityProvider } from "../src/calendar/provider.js";
import { defaultPolicy } from "../src/config/policy.js";
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
      latestStart: "2026-05-04T09:00:00-04:00",
      durationHours: 4,
      timezone: "America/New_York",
      requestedDate: "2026-05-04",
      isFlexible: false
    },
    compensation: {
      payType: "hourly",
      hourlyRate: 65,
      totalBudget: 260,
      minimumPay: 65,
      maximumPay: 260,
      estimatedHours: 4
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

class FakeCalendarProvider implements CalendarAvailabilityProvider {
  readonly name = "fake";

  constructor(
    private readonly busyIntervals: BusyInterval[],
    private readonly dailyBusyIntervals: Record<string, BusyInterval[]> = {}
  ) {}

  async getBusyIntervalsForJob(): Promise<BusyInterval[]> {
    return this.busyIntervals;
  }

  async getBusyIntervalsForDate(anchorIso: string): Promise<BusyInterval[]> {
    const key = anchorIso.slice(0, 10);
    return this.dailyBusyIntervals[key] ?? [];
  }
}

test("evaluateJob passes calendar busy intervals into decisioning", async () => {
  const job = createJob();
  const provider = new FakeCalendarProvider([
    {
      start: "2026-05-04T09:45:00-04:00",
      end: "2026-05-04T10:45:00-04:00",
      label: "Existing job"
    }
  ]);

  const result = await evaluateJob(
    job,
    {
      ...defaultPolicy,
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    },
    provider
  );

  assert.equal(result.busyIntervals.length, 1);
  assert.equal(result.decision.type, "counter_date");
  assert.equal(result.decision.reason, "SLOT_UNAVAILABLE");
  assert.equal(result.decision.counterOffer?.counterStart, "2026-05-04T11:15:00-04:00");
  assert.equal(result.decision.counterOffer?.counterEnd, "2026-05-04T15:15:00-04:00");
});

test("evaluateJob searches future weekdays with calendar data when no same-day slot exists", async () => {
  const job = createJob({
    requestedWindow: {
      ...createJob().requestedWindow,
      earliestStart: "2026-05-02T19:00:00-04:00",
      latestStart: "2026-05-02T19:00:00-04:00",
      requestedDate: "2026-05-02",
      durationHours: 3,
      isFlexible: false
    }
  });
  const provider = new FakeCalendarProvider([], {
    "2026-05-04": [
      {
        start: "2026-05-04T09:00:00-04:00",
        end: "2026-05-04T17:00:00-04:00",
        label: "Busy day"
      }
    ],
    "2026-05-05": [
      {
        start: "2026-05-05T09:00:00-04:00",
        end: "2026-05-05T17:00:00-04:00",
        label: "Busy day"
      }
    ],
    "2026-05-06": []
  });

  const result = await evaluateJob(
    job,
    {
      ...defaultPolicy,
      travel: {
        ...defaultPolicy.travel,
        flatTravel: 0
      }
    },
    provider
  );

  assert.equal(result.decision.type, "counter_date");
  assert.equal(result.decision.reason, "OUTSIDE_WORKING_HOURS");
  assert.equal(result.decision.counterOffer?.counterStart, "2026-05-06T09:00:00-04:00");
  assert.equal(result.decision.counterOffer?.counterEnd, "2026-05-06T12:00:00-04:00");
});
