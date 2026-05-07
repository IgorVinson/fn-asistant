// ================================================================
// core.js — Pure scheduling functions (no side effects, no API calls)
// ================================================================

const WORK_START = "09:30";
const WORK_END = "18:00";
const COUNTER_LATEST = "15:00";
const TRAVEL_SPEED_THRESHOLD = 30;
const TRAVEL_MIN_PER_MILE = 1.25;
const AVERAGE_SPEED = 50;
const DEFAULT_LABOR_HOURS = 2;

function parseTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return { h, m };
}

function dateAtTime(date, timeStr) {
  const { h, m } = parseTime(timeStr);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

// ================================================================
// calculateTravelMinutes — one-way travel time from distance
// ================================================================

export function calculateTravelMinutes(distance) {
  if (distance < TRAVEL_SPEED_THRESHOLD) {
    return distance * TRAVEL_MIN_PER_MILE;
  }
  return (distance / AVERAGE_SPEED) * 60;
}

// ================================================================
// mergeOverlappingBlocks — merge overlapping time blocks, keep
// touching ones separate (end === next start is NOT merged)
// ================================================================

export function mergeOverlappingBlocks(blocks) {
  if (!blocks || blocks.length === 0) return [];

  const sorted = [...blocks]
    .map((b) => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const block of sorted) {
    if (merged.length === 0 || block.start >= merged[merged.length - 1].end) {
      merged.push({ ...block });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        block.end
      );
    }
  }

  return merged.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

// ================================================================
// computeFreeBlocks — gaps between busy blocks within work hours.
// No buffer. Busy blocks are clamped to [WORK_START, WORK_END].
// ================================================================

export function computeFreeBlocks(date, busyBlocks) {
  const dayStart = dateAtTime(date, WORK_START).getTime();
  const dayEnd = dateAtTime(date, WORK_END).getTime();

  // Filter busy blocks that overlap this day, clamp to window
  const dayBusy = busyBlocks
    .filter((b) => b.start.getTime() < dayEnd && b.end.getTime() > dayStart)
    .map((b) => ({
      start: Math.max(b.start.getTime(), dayStart),
      end: Math.min(b.end.getTime(), dayEnd),
    }));

  // Merge overlapping (touching kept separate)
  const sorted = [...dayBusy].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const block of sorted) {
    if (merged.length === 0 || block.start >= merged[merged.length - 1].end) {
      merged.push({ ...block });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        block.end
      );
    }
  }

  // Find gaps between merged busy blocks (no buffer)
  const freeSlots = [];
  let cursor = dayStart;

  for (const block of merged) {
    if (cursor < block.start) {
      freeSlots.push({
        start: new Date(cursor),
        end: new Date(block.start),
        durationMinutes: Math.round((block.start - cursor) / (60 * 1000)),
      });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (cursor < dayEnd) {
    freeSlots.push({
      start: new Date(cursor),
      end: new Date(dayEnd),
      durationMinutes: Math.round((dayEnd - cursor) / (60 * 1000)),
    });
  }

  return freeSlots;
}

// ================================================================
// tryFitAppliedTime — try to fit WO at its requested time window.
// Travel is added to block start: laborStart >= block.start + travel.
// Must finish labor by requestedEnd, and return home by block end.
// ================================================================

export function tryFitAppliedTime(workOrder, freeBlocks, travelMinutes) {
  const laborMs =
    (workOrder.estLaborHours || DEFAULT_LABOR_HOURS) * 60 * 60 * 1000;
  const travelMs = travelMinutes * 60 * 1000;
  const requestedStart = new Date(workOrder.time.start).getTime();
  const requestedEnd = new Date(workOrder.time.end).getTime();

  for (const block of freeBlocks) {
    // You can't arrive before: block.start + drive time
    const earliestArrivalMs = block.start.getTime() + travelMs;

    // Labor start must be >= both earliestArrival and requestedStart
    const laborStartMs = Math.max(earliestArrivalMs, requestedStart);
    const laborEndMs = laborStartMs + laborMs;

    // Must finish labor by the requested end time
    if (laborEndMs > requestedEnd) continue;

    // Must finish work before the free block ends
    if (laborEndMs > block.end.getTime()) continue;

    return {
      laborStart: new Date(laborStartMs),
      laborEnd: new Date(laborEndMs),
    };
  }

  return null;
}

// ================================================================
// tryFitCounterTime — find ANY free block for a counter proposal.
// Uses workDayStart + travel as earliest arrival (global).
// Ignores requested window. Respects latestStart (default 15:00).
// ================================================================

export function tryFitCounterTime(workOrder, freeBlocks, travelMinutes, options = {}) {
  const laborMs =
    (workOrder.estLaborHours || DEFAULT_LABOR_HOURS) * 60 * 60 * 1000;
  const travelMs = travelMinutes * 60 * 1000;

  // Project requested start time to the check date if provided
  const woStartRaw = new Date(workOrder.time.start);
  const requestedStartMs = options.checkDate
    ? new Date(
        options.checkDate.getFullYear(),
        options.checkDate.getMonth(),
        options.checkDate.getDate(),
        woStartRaw.getHours(),
        woStartRaw.getMinutes()
      ).getTime()
    : woStartRaw.getTime();

  const latestStartMs = options.latestStart
    ? options.latestStart.getTime()
    : dateAtTime(
        new Date(woStartRaw.getFullYear(), woStartRaw.getMonth(), woStartRaw.getDate()),
        COUNTER_LATEST
      ).getTime();

  // Earliest possible arrival: work day start + travel
  // Defaults to WO date's work day start + travel if not provided
  const woDate = new Date(
    woStartRaw.getFullYear(),
    woStartRaw.getMonth(),
    woStartRaw.getDate()
  );
  const earliestArrivalMs =
    options.earliestArrival != null
      ? options.earliestArrival.getTime()
      : dateAtTime(woDate, WORK_START).getTime() + travelMs;

  for (const block of freeBlocks) {
    // Labor start: at least block start, earliest arrival, and requested start
    const laborStartMs = Math.max(
      block.start.getTime(),
      earliestArrivalMs,
      requestedStartMs
    );

    // Must start by latestStart
    if (laborStartMs > latestStartMs) continue;

    const laborEndMs = laborStartMs + laborMs;

    // Must finish work before the free block ends
    if (laborEndMs > block.end.getTime()) continue;

    return {
      laborStart: new Date(laborStartMs),
      laborEnd: new Date(laborEndMs),
    };
  }

  return null;
}
