import test from "node:test";
import assert from "node:assert/strict";

import { evaluateAvailability } from "../src/domain/evaluateAvailability.js";
import { defaultPolicy } from "../src/config/policy.js";
import type { BusyInterval } from "../src/types/availability.js";
import type { RequestedWindow } from "../src/types/job.js";

function createWindow(overrides: Partial<RequestedWindow> = {}): RequestedWindow {
  return {
    earliestStart: "2026-05-04T09:00:00-04:00",
    latestStart: "2026-05-04T14:00:00-04:00",
    durationHours: 3,
    timezone: "America/New_York",
    requestedDate: "2026-05-04",
    isFlexible: true,
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

test("flexible window is available when any requested start overlaps working hours", () => {
  const result = evaluateAvailability(
    createWindow({
      earliestStart: "2026-05-04T08:00:00-04:00",
      latestStart: "2026-05-04T17:00:00-04:00"
    }),
    defaultPolicy.workingHours
  );

  assert.equal(result.withinWorkingHours, true);
  assert.equal(result.requestedSlotAvailable, true);
  assert.equal(result.hasSameDayCounterSlot, false);
});

test("fixed slot before workday is unavailable", () => {
  const result = evaluateAvailability(
    createWindow({
      earliestStart: "2026-05-04T08:00:00-04:00",
      latestStart: "2026-05-04T08:30:00-04:00",
      isFlexible: false
    }),
    defaultPolicy.workingHours
  );

  assert.equal(result.withinWorkingHours, false);
  assert.equal(result.requestedSlotAvailable, false);
  assert.equal(result.hasSameDayCounterSlot, true);
  assert.equal(result.counterStart, "2026-05-04T09:00:00-04:00");
  assert.equal(result.counterEnd, "2026-05-04T12:00:00-04:00");
});

test("fixed slot inside workday is available", () => {
  const result = evaluateAvailability(
    createWindow({
      earliestStart: "2026-05-04T10:00:00-04:00",
      latestStart: "2026-05-04T10:00:00-04:00",
      isFlexible: false
    }),
    defaultPolicy.workingHours
  );

  assert.equal(result.withinWorkingHours, true);
  assert.equal(result.requestedSlotAvailable, true);
  assert.equal(result.counterStart, undefined);
});

test("late fixed slot after workday has no same-day counter slot", () => {
  const result = evaluateAvailability(
    createWindow({
      earliestStart: "2026-05-04T19:00:00-04:00",
      latestStart: "2026-05-04T19:00:00-04:00",
      isFlexible: false
    }),
    defaultPolicy.workingHours
  );

  assert.equal(result.withinWorkingHours, false);
  assert.equal(result.requestedSlotAvailable, false);
  assert.equal(result.hasSameDayCounterSlot, false);
  assert.equal(result.hasFutureCounterSlot, true);
  assert.equal(result.futureCounterStart, "2026-05-05T09:00:00-04:00");
  assert.equal(result.futureCounterEnd, "2026-05-05T12:00:00-04:00");
});

test("calendar conflict with buffer pushes counter slot later in the day", () => {
  const result = evaluateAvailability(
    createWindow({
      earliestStart: "2026-05-04T09:00:00-04:00",
      latestStart: "2026-05-04T09:00:00-04:00",
      durationHours: 4,
      isFlexible: false
    }),
    defaultPolicy.workingHours,
    [createBusyInterval()]
  );

  assert.equal(result.withinWorkingHours, true);
  assert.equal(result.requestedSlotAvailable, false);
  assert.equal(result.hasSameDayCounterSlot, true);
  assert.equal(result.counterStart, "2026-05-04T11:15:00-04:00");
  assert.equal(result.counterEnd, "2026-05-04T15:15:00-04:00");
});

test("flexible requested window can still fit after a buffered conflict", () => {
  const result = evaluateAvailability(
    createWindow({
      earliestStart: "2026-05-04T09:00:00-04:00",
      latestStart: "2026-05-04T14:00:00-04:00",
      durationHours: 4,
      isFlexible: true
    }),
    defaultPolicy.workingHours,
    [createBusyInterval()]
  );

  assert.equal(result.withinWorkingHours, true);
  assert.equal(result.requestedSlotAvailable, true);
  assert.equal(result.feasibleRequestedStart, "2026-05-04T11:15:00-04:00");
  assert.equal(result.feasibleRequestedEnd, "2026-05-04T15:15:00-04:00");
});
