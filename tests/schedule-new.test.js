import test from "node:test";
import assert from "node:assert/strict";

// ================================================================
// Imports from the bridge module (current implementation)
// ================================================================

import {
  calculateTravelMinutes,
  mergeOverlappingBlocks,
  computeFreeBlocks,
  tryFitAppliedTime,
  tryFitCounterTime,
  evaluateWorkOrder,
} from "../utils/schedule-new/index.js";

// ================================================================
// HELPERS
// ================================================================

const TZ = "-04:00";

function d(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00${TZ}`);
}

function makeWO(overrides = {}) {
  return {
    id: "WO-TEST-1",
    platform: "WorkMarket",
    company: "Granite Telecommunications",
    title: "Test Job",
    isRequestedWindow: false,
    time: {
      start: "2026-05-06T10:00",
      end: "2026-05-06T12:00",
    },
    payRange: { min: 50, max: 150 },
    payType: "hourly",
    hourlyRate: 50,
    estLaborHours: 2,
    distance: 10,
    ...overrides,
  };
}

function makeBusy(dateStr, startTime, endTime, source = "google") {
  return {
    start: d(dateStr, startTime),
    end: d(dateStr, endTime),
    source,
    summary: `${source} event`,
  };
}

function sameDay(a, b) {
  // Skip the stub - this is a test-internal helper, will be implemented when used
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ================================================================
// TRAVEL TIME
// ================================================================

test("calculateTravelMinutes", async (t) => {
  await t.test("short distance (< 30mi): distance * 1.25", () => {
    assert.equal(calculateTravelMinutes(10), 12.5);
    assert.equal(calculateTravelMinutes(20), 25);
    assert.equal(calculateTravelMinutes(29), 36.25);
  });

  await t.test("long distance (>= 30mi): (distance / 50) * 60", () => {
    assert.equal(calculateTravelMinutes(30), 36);
    assert.equal(calculateTravelMinutes(50), 60);
    assert.equal(calculateTravelMinutes(100), 120);
  });

  await t.test("zero distance returns zero", () => {
    assert.equal(calculateTravelMinutes(0), 0);
  });
});

// ================================================================
// MERGE OVERLAPPING BLOCKS
// ================================================================

test("mergeOverlappingBlocks", async (t) => {
  await t.test("empty array returns empty", () => {
    assert.deepEqual(mergeOverlappingBlocks([]), []);
  });

  await t.test("non-overlapping blocks stay separate", () => {
    const blocks = [
      makeBusy("2026-05-06", "10:00", "11:00"),
      makeBusy("2026-05-06", "13:00", "14:00"),
    ];
    const merged = mergeOverlappingBlocks(blocks);
    assert.equal(merged.length, 2);
    assert.deepEqual(merged[0].start, d("2026-05-06", "10:00"));
    assert.deepEqual(merged[0].end, d("2026-05-06", "11:00"));
    assert.deepEqual(merged[1].start, d("2026-05-06", "13:00"));
    assert.deepEqual(merged[1].end, d("2026-05-06", "14:00"));
  });

  await t.test("overlapping blocks merge into one", () => {
    const blocks = [
      makeBusy("2026-05-06", "10:00", "12:00"),
      makeBusy("2026-05-06", "11:00", "13:00"),
    ];
    const merged = mergeOverlappingBlocks(blocks);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].start, d("2026-05-06", "10:00"));
    assert.deepEqual(merged[0].end, d("2026-05-06", "13:00"));
  });

  await t.test("fully contained block does not extend", () => {
    const blocks = [
      makeBusy("2026-05-06", "10:00", "15:00"),
      makeBusy("2026-05-06", "11:00", "13:00"),
    ];
    const merged = mergeOverlappingBlocks(blocks);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].start, d("2026-05-06", "10:00"));
    assert.deepEqual(merged[0].end, d("2026-05-06", "15:00"));
  });

  await t.test("touching blocks (end === next start) treated as non-overlapping", () => {
    const blocks = [
      makeBusy("2026-05-06", "10:00", "11:00"),
      makeBusy("2026-05-06", "11:00", "12:00"),
    ];
    const merged = mergeOverlappingBlocks(blocks);
    assert.equal(merged.length, 2);
  });
});

// ================================================================
// COMPUTE FREE BLOCKS (gaps between busy, 9:30-18:00 window)
// ================================================================

test("computeFreeBlocks", async (t) => {
  const date = d("2026-05-06", "12:00"); // Wed May 6

  await t.test("no busy blocks → one free block 9:30-18:00", () => {
    const free = computeFreeBlocks(date, []);
    assert.equal(free.length, 1);
    assert.deepEqual(free[0].start, d("2026-05-06", "09:30"));
    assert.deepEqual(free[0].end, d("2026-05-06", "18:00"));
  });

  await t.test("one busy block midday → two free blocks", () => {
    const busy = [makeBusy("2026-05-06", "13:00", "14:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 2);
    assert.deepEqual(free[0].start, d("2026-05-06", "09:30"));
    assert.deepEqual(free[0].end, d("2026-05-06", "13:00"));
    assert.deepEqual(free[1].start, d("2026-05-06", "14:00"));
    assert.deepEqual(free[1].end, d("2026-05-06", "18:00"));
  });

  await t.test("three non-overlapping busy blocks → four free blocks", () => {
    const busy = [
      makeBusy("2026-05-06", "10:00", "11:00"),
      makeBusy("2026-05-06", "13:00", "14:00"),
      makeBusy("2026-05-06", "16:00", "17:00"),
    ];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 4);
  });

  await t.test("overlapping busy blocks are merged before finding gaps", () => {
    const busy = [
      makeBusy("2026-05-06", "10:00", "12:00"),
      makeBusy("2026-05-06", "11:00", "13:00"),
    ];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 2);
    assert.deepEqual(free[0].end, d("2026-05-06", "10:00"));
    assert.deepEqual(free[1].start, d("2026-05-06", "13:00"));
  });

  await t.test("busy block at very start of work day (9:30) → no leading gap", () => {
    const busy = [makeBusy("2026-05-06", "09:30", "11:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 1);
    assert.deepEqual(free[0].start, d("2026-05-06", "11:00"));
    assert.deepEqual(free[0].end, d("2026-05-06", "18:00"));
  });

  await t.test("busy block at very end of work day → no trailing gap", () => {
    const busy = [makeBusy("2026-05-06", "17:00", "18:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 1);
    assert.deepEqual(free[0].end, d("2026-05-06", "17:00"));
  });

  await t.test("busy block spans the full work day → no free blocks", () => {
    const busy = [makeBusy("2026-05-06", "09:30", "18:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 0);
  });

  await t.test("busy block outside work hours does not matter", () => {
    const busy = [makeBusy("2026-05-06", "07:00", "08:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 1);
    assert.deepEqual(free[0].start, d("2026-05-06", "09:30"));
    assert.deepEqual(free[0].end, d("2026-05-06", "18:00"));
  });

  await t.test("busy block straddles start of day — clamped to window", () => {
    const busy = [makeBusy("2026-05-06", "08:00", "10:30")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 1);
    assert.deepEqual(free[0].start, d("2026-05-06", "10:30"));
    assert.deepEqual(free[0].end, d("2026-05-06", "18:00"));
  });

  await t.test("busy block straddles end of day — clamped to window", () => {
    const busy = [makeBusy("2026-05-06", "17:00", "19:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free.length, 1);
    assert.deepEqual(free[0].start, d("2026-05-06", "09:30"));
    assert.deepEqual(free[0].end, d("2026-05-06", "17:00"));
  });

  await t.test("each free block has durationMinutes", () => {
    const busy = [makeBusy("2026-05-06", "13:00", "14:00")];
    const free = computeFreeBlocks(date, busy);
    assert.equal(free[0].durationMinutes, 210); // 9:30-13:00 = 3.5h
    assert.equal(free[1].durationMinutes, 240); // 14:00-18:00 = 4h
  });
});

// ================================================================
// tryFitAppliedTime — does WO fit at its REQUESTED time?
// ================================================================

test("tryFitAppliedTime", async (t) => {
  // Default WO: Wed 5/6, 10:00-12:00, 2hr labor, 10mi → travel = 12.5min one-way
  // Total occupied window = 2 * 12.5 + 120 = 145 min

  await t.test("WO fits in empty day at requested time", () => {
    const wo = makeWO();
    const free = [{
      start: d("2026-05-06", "09:30"),
      end: d("2026-05-06", "18:00"),
      durationMinutes: 510,
    }];
    const result = tryFitAppliedTime(wo, free, 12.5);
    assert.ok(result);
    assert.deepEqual(result.laborStart, d("2026-05-06", "10:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "12:00"));
  });

  await t.test("WO fits with busy block AFTER the occupied window", () => {
    const wo = makeWO();
    const free = [
      { start: d("2026-05-06", "09:30"), end: d("2026-05-06", "15:00"), durationMinutes: 330 },
      { start: d("2026-05-06", "16:00"), end: d("2026-05-06", "18:00"), durationMinutes: 120 },
    ];
    const result = tryFitAppliedTime(wo, free, 12.5);
    assert.ok(result);
    assert.deepEqual(result.laborStart, d("2026-05-06", "10:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "12:00"));
  });

  await t.test("returns null when travel pushes occupation past free block end", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
      estLaborHours: 2,
      distance: 10,
    });
    // Free block ends at 11:30 — occupation needs until 12:12:30
    const free = [{
      start: d("2026-05-06", "09:30"),
      end: d("2026-05-06", "11:30"),
      durationMinutes: 120,
    }];
    const result = tryFitAppliedTime(wo, free, 12.5);
    assert.equal(result, null);
  });

  await t.test("returns null when free block starts AFTER requested time", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
    });
    // Free block is 13:00-18:00, can't start at 10:00
    const free = [{
      start: d("2026-05-06", "13:00"),
      end: d("2026-05-06", "18:00"),
      durationMinutes: 300,
    }];
    const result = tryFitAppliedTime(wo, free, 12.5);
    assert.equal(result, null);
  });

  await t.test("returns null when WO is entirely outside free blocks", () => {
    const wo = makeWO(); // 10:00-12:00
    const free = [{
      start: d("2026-05-06", "14:00"),
      end: d("2026-05-06", "18:00"),
      durationMinutes: 240,
    }];
    const result = tryFitAppliedTime(wo, free, 12.5);
    assert.equal(result, null);
  });

  await t.test("fits in second block when first is too short", () => {
    const wo = makeWO(); // 10:00-12:00
    const free = [
      { start: d("2026-05-06", "09:30"), end: d("2026-05-06", "10:30"), durationMinutes: 60 },
      { start: d("2026-05-06", "11:00"), end: d("2026-05-06", "18:00"), durationMinutes: 420 },
    ];
    // First block 9:30-10:30: laborStart=max(9:30+12.5,10:00)=10:00, return=12:12:30>10:30 → skip
    // Second block 11:00-18:00: laborStart=max(11:00+12.5,10:00)=11:12:30, laborEnd=13:12:30
    // 13:12:30 > 12:00 (WO end) → null
    const result = tryFitAppliedTime(wo, free, 12.5);
    assert.equal(result, null);
  });

  await t.test("WO with long travel — labor start shifted by travel", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T14:00" },
      estLaborHours: 2,
      distance: 30, // travel = 36 min one-way
    });
    // earliest arrival = 9:30 + 36 = 10:06
    // laborStart = max(9:30+36=10:06, 10:00) = 10:06
    // laborEnd = 12:06, return = 12:42 ≤ 18:00
    const free = [{
      start: d("2026-05-06", "09:30"),
      end: d("2026-05-06", "18:00"),
      durationMinutes: 510,
    }];
    const result = tryFitAppliedTime(wo, free, 36);
    assert.ok(result);
    assert.deepEqual(result.laborStart, d("2026-05-06", "10:06"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "12:06"));
  });

  await t.test("WO with zero travel — no travel padding", () => {
    const wo = makeWO({ distance: 0 });
    const free = [{
      start: d("2026-05-06", "09:50"),
      end: d("2026-05-06", "12:10"),
      durationMinutes: 140,
    }];
    // labor can start at 10:00 (>= requested and >= block start)
    // occupy = 10:00 to 12:00 (no travel padding)
    const result = tryFitAppliedTime(wo, free, 0);
    assert.ok(result);
    assert.deepEqual(result.laborStart, d("2026-05-06", "10:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "12:00"));
  });
});

// ================================================================
// tryFitCounterTime — find ANY free block for counter
// ================================================================

test("tryFitCounterTime", async (t) => {
  // Latest counter start: 15:00

  await t.test("picks the earliest free block that fits with travel", () => {
    const wo = makeWO(); // 2hr, 10mi → travel=12.5, totalRequired=145
    const free = [
      { start: d("2026-05-06", "09:30"), end: d("2026-05-06", "11:00"), durationMinutes: 90 },
      { start: d("2026-05-06", "12:00"), end: d("2026-05-06", "18:00"), durationMinutes: 360 },
    ];
    // First block 9:30-11:00: 90 min < 145 min totalRequired → skip
    // Second block 12:00-18:00: fits
    // laborStart = max(12:00, 9:30 + 12.5 = 9:42:30) = 12:00
    // laborEnd = 14:00, occupyEnd = 14:12:30 <= 18:00 ✓
    // laborStart = 12:00 <= 15:00 ✓
    const result = tryFitCounterTime(wo, free, 12.5, {
      latestStart: d("2026-05-06", "15:00"),
    });
    assert.ok(result);
    assert.deepEqual(result.laborStart, d("2026-05-06", "12:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "14:00"));
  });

  await t.test("respects latestStart — skips block where labor would start after 15:00", () => {
    const wo = makeWO();
    const free = [
      { start: d("2026-05-06", "15:30"), end: d("2026-05-06", "18:00"), durationMinutes: 150 },
    ];
    // laborStart = max(15:30, 9:42:30) = 15:30 > 15:00 → skip
    const result = tryFitCounterTime(wo, free, 12.5, {
      latestStart: d("2026-05-06", "15:00"),
    });
    assert.equal(result, null);
  });

  await t.test("returns null when no block is large enough for totalRequired", () => {
    const wo = makeWO({ estLaborHours: 4 }); // 4hr labor + 25 travel = 265 min needed
    const free = [{
      start: d("2026-05-06", "09:30"),
      end: d("2026-05-06", "13:00"), // 210 min < 265 → doesn't fit
      durationMinutes: 210,
    }];
    const result = tryFitCounterTime(wo, free, 12.5, {
      latestStart: d("2026-05-06", "15:00"),
    });
    assert.equal(result, null);
  });

  await t.test("labor is positioned at free block start + travel", () => {
    // Ensures counter proposal accounts for drive time
    const wo = makeWO({ distance: 30 }); // travel = 36 min one-way, totalRequired = 192
    const free = [{
      start: d("2026-05-06", "09:30"),
      end: d("2026-05-06", "18:00"),
      durationMinutes: 510,
    }];
    const result = tryFitCounterTime(wo, free, 36, {
      latestStart: d("2026-05-06", "15:00"),
    });
    assert.ok(result);
    // laborStart = max(9:30, 9:30 + 36) = 10:06
    assert.deepEqual(result.laborStart, d("2026-05-06", "10:06"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "12:06"));
  });

  await t.test("picks second block when first would violate latestStart", () => {
    const wo = makeWO(); // 2hr, travel=12.5
    const free = [
      { start: d("2026-05-06", "14:50"), end: d("2026-05-06", "15:20"), durationMinutes: 30 },
      { start: d("2026-05-06", "11:00"), end: d("2026-05-06", "13:30"), durationMinutes: 150 },
    ];
    // Free blocks come sorted by start time:
    // Block 11:00-13:30: totalRequired=145, block duration=150, fits
    // laborStart = max(11:00, 9:42:30) = 11:00 ≤ 15:00 ✓
    const result = tryFitCounterTime(wo, free, 12.5, {
      latestStart: d("2026-05-06", "15:00"),
    });
    assert.ok(result);
    assert.deepEqual(result.laborStart, d("2026-05-06", "11:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "13:00"));
  });
});

// ================================================================
// evaluateWorkOrder — full pipeline
// ================================================================

test("evaluateWorkOrder", async (t) => {
  const today = d("2026-05-06", "12:00"); // Wed (noon, so all morning slots are in the past)

  await t.test("APPLY: WO fits in empty schedule on request day", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
      estLaborHours: 2,
      distance: 10,
    });
    const result = evaluateWorkOrder(wo, [], { today });
    assert.equal(result.action, "APPLY");
    assert.ok(sameDay(result.day, d("2026-05-06", "14:00")));
    assert.deepEqual(result.laborStart, d("2026-05-06", "14:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "16:00"));
  });

  await t.test("APPLY: WO fits between busy blocks on request day", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
    });
    const busy = [
      makeBusy("2026-05-06", "13:00", "13:30"),
      makeBusy("2026-05-06", "17:00", "18:00"),
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "APPLY");
  });

  await t.test("COUNTER: today busy at requested time, free later same day", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
      estLaborHours: 2,
      distance: 10,
    });
    const busy = [
      makeBusy("2026-05-06", "09:30", "14:00"), // busy during request, free after
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "COUNTER");
    assert.ok(sameDay(result.day, d("2026-05-06", "14:00")));
    assert.deepEqual(result.laborStart, d("2026-05-06", "14:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "16:00"));
  });

  await t.test("COUNTER: today fully booked, finds slot on day+1 (Thursday)", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
    });
    const busy = [
      makeBusy("2026-05-06", "09:30", "18:00"), // Wed fully booked
      makeBusy("2026-05-07", "13:00", "14:00"), // Thu has a small busy
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "COUNTER");
    assert.ok(sameDay(result.day, d("2026-05-07", "09:30")));
    // First free block Thu: 9:30-13:00 → laborStart = max(9:30, earliestArrival)
    assert.deepEqual(result.laborStart, d("2026-05-07", "10:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-07", "12:00"));
  });

  await t.test("COUNTER: today+tomorrow booked, finds slot on day+2 (Friday)", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
    });
    const busy = [
      makeBusy("2026-05-06", "09:30", "18:00"), // Wed
      makeBusy("2026-05-07", "09:30", "18:00"), // Thu
      // Fri empty
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "COUNTER");
    assert.ok(sameDay(result.day, d("2026-05-08", "09:30")));
    assert.deepEqual(result.laborStart, d("2026-05-08", "10:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-08", "12:00"));
  });

  await t.test("REJECT: all 3 days (Wed-Fri) fully booked", () => {
    const wo = makeWO();
    const busy = [
      makeBusy("2026-05-06", "09:30", "18:00"),
      makeBusy("2026-05-07", "09:30", "18:00"),
      makeBusy("2026-05-08", "09:30", "18:00"),
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "REJECT");
    assert.equal(result.laborStart, null);
    assert.equal(result.laborEnd, null);
  });

  await t.test("skips Saturday and Sunday in the day+1, day+2 search", () => {
    // today = Friday, day+1 = Sat (skip), day+2 = Sun (skip), so no days left → REJECT
    const friday = d("2026-05-08", "12:00"); // Friday May 8
    const wo = makeWO({
      time: { start: "2026-05-08T10:00", end: "2026-05-08T12:00" },
    });
    const busy = [
      makeBusy("2026-05-08", "09:30", "18:00"), // Fri booked
      // Sat/Sun are weekends — should NOT be checked
    ];
    const result = evaluateWorkOrder(wo, busy, { today: friday });
    assert.equal(result.action, "REJECT");
  });

  await t.test("future days only return COUNTER, never APPLY", () => {
    const wo = makeWO({
      time: { start: "2026-05-07T10:00", end: "2026-05-07T12:00" },
    });
    const busy = [
      makeBusy("2026-05-06", "10:00", "14:00"), // Wed partially busy
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    // WO is for Thu but today is Wed — Thu can only COUNTER
    // However, the WO date IS Thu, so the first day we check is the WO's own day.
    // The question is: when the WO date != today, do we still allow APPLY on that day?
    // Current design says: APPLY only when the day being checked IS today.
    // If WO is for tomorrow and we check tomorrow, it should still be COUNTER (future day rule).
    assert.notEqual(result.action, "APPLY");
  });

  await t.test("WO on a future date: evaluates that date directly, still only COUNTER", () => {
    const wo = makeWO({
      time: { start: "2026-05-07T10:00", end: "2026-05-07T12:00" },
    });
    const result = evaluateWorkOrder(wo, [], { today });
    // WO date is Thu May 7, today is Wed May 6
    // The function should evaluate Thu (WO's date) as the first check
    // But since it's a future day, APPLY is not allowed → COUNTER
    assert.equal(result.action, "COUNTER");
    assert.ok(sameDay(result.day, d("2026-05-07", "10:00")));
  });

  await t.test("COUNTER slot respects 15:00 latest even on future days", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T10:00", end: "2026-05-06T12:00" },
    });
    const busy = [
      makeBusy("2026-05-06", "09:30", "18:00"), // Wed fully booked
    ];
    // Thu May 7: free 9:30-18:00, but a block starting at 16:00 wouldn't work for counter
    // since laborStart would be 16:00 > 15:00. But there's an earlier block:
    // free block 9:30-18:00 → laborStart = 10:00 ≤ 15:00 ✓
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "COUNTER");
    assert.ok(sameDay(result.day, d("2026-05-07", "09:30")));
    assert.deepEqual(result.laborStart, d("2026-05-07", "10:00"));
  });

  await t.test("includes reason string in the result", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
    });
    const result = evaluateWorkOrder(wo, [], { today });
    assert.ok(typeof result.reason === "string");
    assert.ok(result.reason.length > 0);
  });

  await t.test("APPLY preferred over COUNTER when both are possible", () => {
    // If both APPLY and COUNTER slots exist, APPLY wins
    const wo = makeWO({
      time: { start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
    });
    const result = evaluateWorkOrder(wo, [], { today });
    assert.equal(result.action, "APPLY");
  });

  await t.test("REJECT when free blocks exist but all too short for totalRequired", () => {
    const wo = makeWO({
      estLaborHours: 9, // 540 min + 12.5 travel = 552.5 min needed
      distance: 10,
    });
    // Full day block 9:30-18:00 = 510 min, but 552.5 > 510, and all 3 days blocked
    const busy = [
      makeBusy("2026-05-06", "09:30", "18:00"), // Wed
      makeBusy("2026-05-07", "09:30", "18:00"), // Thu
      makeBusy("2026-05-08", "09:30", "18:00"), // Fri
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "REJECT");
  });

  await t.test("mixed busy blocks from both Google Calendar and WorkMarket", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T15:00", end: "2026-05-06T17:00" },
    });
    const busy = [
      makeBusy("2026-05-06", "12:00", "14:00", "google"),
      makeBusy("2026-05-06", "13:00", "14:30", "workmarket"), // overlaps → merged
    ];
    // Merged: 12:00-14:30. Free: 9:30-12:00 and 14:30-18:00
    // WO 15:00-17:00 in second block: laborStart=15:00, laborEnd=17:00
    // occupyEnd=17:12:30 <= 18:00 ✓
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "APPLY");
  });

  await t.test("long travel (>30 mi) uses speed-based formula", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
      estLaborHours: 2,
      distance: 50, // travel = (50/50)*60 = 60 min one-way, total = 120 + 120 = 240
    });
    const busy = [
      makeBusy("2026-05-06", "18:00", "18:30"), // after work day, doesn't matter
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "APPLY");
    // laborStart = 14:00, laborEnd = 16:00
    // occupied: 13:00 (leave) to 17:00 (return) — fits in 9:30-18:00
    assert.deepEqual(result.laborStart, d("2026-05-06", "14:00"));
    assert.deepEqual(result.laborEnd, d("2026-05-06", "16:00"));
  });

  await t.test("edge: WO at 9:30 — earliest arrival = 9:30 + travel", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T09:30", end: "2026-05-06T11:30" },
      estLaborHours: 2,
      distance: 10, // travel = 12.5
    });
    // earliest arrival = 9:30 + 12.5 = 9:42:30
    // laborStart = max(9:30 requested, 9:42:30 arrival) = 9:42:30
    // But 9:42:30 might be beyond the requested window end
    // With free block 9:30-18:00:
    // laborStart = max(free.start(9:30), earliestArrival(9:42:30), WO.start(9:30)) = 9:42:30
    // 9:42:30 > 9:30 requested... but is 9:42:30 <= WO.time.end (11:30)? Yes, if end means latest start.
    // If end means the work end time (9:30+2hr=11:30), then laborStart can't be 9:42:30 because
    // laborEnd would be 11:42:30 > 11:30, and occupyEnd = 11:55 > block end? Actually 11:55 < 18:00 so it fits the block.
    // But laborEnd (11:42:30) > WO.time.end (11:30) means we finish after the buyer's expected time.
    // This is a gray area. Let's adjust the test to make the WO accommodate the travel.
    const free = [{
      start: d("2026-05-06", "09:30"),
      end: d("2026-05-06", "18:00"),
      durationMinutes: 510,
    }];
    const result = tryFitAppliedTime(wo, free, 12.5);
    // With travel, earliest arrival = 9:42:30.
    // laborStart = max(9:30 requested, 9:42:30 arrival) = 9:42:30
    // We'd finish labor at 11:42:30, which is past WO.time.end (11:30).
    // This means the job can't be done exactly as requested.
    // Depending on interpretation: either this is null (can't fit exactly) or we adjust.
    // For now, assert that APPLY tries exact fit, so null if we can't make the requested end.
    assert.equal(result, null);
  });
});

// ================================================================
// Result shape contract
// ================================================================

test("evaluateWorkOrder result always has the same shape", async (t) => {
  const today = d("2026-05-06", "12:00");

  await t.test("APPLY result shape", () => {
    const wo = makeWO({
      time: { start: "2026-05-06T14:00", end: "2026-05-06T16:00" },
    });
    const result = evaluateWorkOrder(wo, [], { today });
    assert.ok(result instanceof Object);
    assert.ok(["APPLY", "COUNTER", "REJECT"].includes(result.action));
    assert.ok(result.laborStart instanceof Date || result.laborStart === null);
    assert.ok(result.laborEnd instanceof Date || result.laborEnd === null);
    assert.ok(result.day instanceof Date || result.day === null);
    assert.ok(typeof result.reason === "string");
  });

  await t.test("REJECT result shape", () => {
    const wo = makeWO();
    const busy = [
      makeBusy("2026-05-06", "09:30", "18:00"),
      makeBusy("2026-05-07", "09:30", "18:00"),
      makeBusy("2026-05-08", "09:30", "18:00"),
    ];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "REJECT");
    assert.equal(result.laborStart, null);
    assert.equal(result.laborEnd, null);
  });

  await t.test("COUNTER result shape", () => {
    const wo = makeWO();
    const busy = [makeBusy("2026-05-06", "09:30", "18:00")];
    const result = evaluateWorkOrder(wo, busy, { today });
    assert.equal(result.action, "COUNTER");
    assert.ok(result.laborStart instanceof Date);
    assert.ok(result.laborEnd instanceof Date);
    assert.ok(result.day instanceof Date);
  });
});
