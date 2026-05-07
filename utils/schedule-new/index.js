// ================================================================
// index.js — evaluateWorkOrder: full decision pipeline
// ================================================================

import {
  calculateTravelMinutes,
  mergeOverlappingBlocks,
  computeFreeBlocks,
  tryFitAppliedTime,
  tryFitCounterTime,
} from "./core.js";

const WORK_START = "09:30";
const COUNTER_LATEST = "15:00";

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateAtTime(date, timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

function isWeekend(date) {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

/**
 * Full scheduling decision for a work order.
 *
 * @param {Object} workOrder  - normalized WO (same shape as current)
 * @param {Array}  busyBlocks - [{start: Date, end: Date, source, summary}, ...]
 * @param {Object} options    - { today: Date }
 * @returns {{ action: "APPLY"|"COUNTER"|"REJECT", laborStart: Date|null, laborEnd: Date|null, day: Date|null, reason: string }}
 */
export function evaluateWorkOrder(workOrder, busyBlocks, options = {}) {
  const today = options.today ? new Date(options.today) : new Date();
  const woStart = new Date(workOrder.time.start);
  const workOrderDate = new Date(
    woStart.getFullYear(),
    woStart.getMonth(),
    woStart.getDate()
  );

  const travelMinutes = calculateTravelMinutes(workOrder.distance || 0);

  function busyForDate(date) {
    const dayStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const dayEnd = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    );
    return busyBlocks.filter(
      b =>
        b.start.getTime() < dayEnd.getTime() &&
        b.end.getTime() > dayStart.getTime()
    );
  }

  function checkDay(date, canApply) {
    const dayBusy = busyForDate(date);
    const free = computeFreeBlocks(date, dayBusy);
    const isToday = sameDay(date, today);

    // Earliest arrival for this day: workDayStart + travel
    const earliestArrival = new Date(
      dateAtTime(date, WORK_START).getTime() + travelMinutes * 60 * 1000
    );

    // TRY APPLY (only for today)
    if (canApply && isToday) {
      const applied = tryFitAppliedTime(workOrder, free, travelMinutes);
      if (applied) {
        return {
          action: "APPLY",
          laborStart: applied.laborStart,
          laborEnd: applied.laborEnd,
          day: date,
          reason: "CALENDAR_AVAILABLE",
        };
      }
    }

    // TRY COUNTER
    const countered = tryFitCounterTime(workOrder, free, travelMinutes, {
      latestStart: dateAtTime(date, COUNTER_LATEST),
      earliestArrival,
      checkDate: date,
    });
    if (countered) {
      return {
        action: "COUNTER",
        laborStart: countered.laborStart,
        laborEnd: countered.laborEnd,
        day: date,
        reason: "COUNTER_DATES",
      };
    }

    return null;
  }

  // 1. Check the work order's own date
  const woDayResult = checkDay(workOrderDate, true);
  if (woDayResult) {
    // APPLY is only allowed when WO date is today
    if (woDayResult.action === "APPLY" && !sameDay(workOrderDate, today)) {
      // Fall through to counter-only for future dates
      const counterResult = checkDay(workOrderDate, false);
      if (counterResult) return counterResult;
    } else {
      return woDayResult;
    }
  }

  // 2. Search next 2 weekdays
  for (let offset = 1; offset <= 2; offset++) {
    const checkDate = new Date(workOrderDate);
    checkDate.setDate(checkDate.getDate() + offset);

    if (isWeekend(checkDate)) continue;

    const result = checkDay(checkDate, false);
    if (result) return result;
  }

  // 3. Nothing found — REJECT
  return {
    action: "REJECT",
    laborStart: null,
    laborEnd: null,
    day: null,
    reason: "SLOT_UNAVAILABLE",
  };
}

export {
  calculateTravelMinutes,
  mergeOverlappingBlocks,
  computeFreeBlocks,
  tryFitAppliedTime,
  tryFitCounterTime,
} from "./core.js";
