import { CONFIG } from "../../config.js";
import logger from "../logger.js";
import { fetchCalendarBusy } from "./fetchCalendarBusy.js";
import { fetchWMBusy } from "./fetchWMBusy.js";
import { fetchFNBusy } from "./fetchFNBusy.js";

export function computeFreeBlocks({
  startDate,
  daysToCheck,
  busyBlocks,
  workStartMinutes,
  workEndMinutes,
  bufferMinutes,
  capacity = 1,
}) {
  const bufferMs = bufferMinutes * 60 * 1000;
  const allFreeBlocks = [];

  for (let dayOffset = 0; dayOffset <= daysToCheck; dayOffset++) {
    const currentDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate() + dayOffset
    );

    if (isWeekend(currentDay)) continue;

    const dayStartMs = new Date(
      currentDay.getFullYear(),
      currentDay.getMonth(),
      currentDay.getDate(),
      Math.floor(workStartMinutes / 60),
      workStartMinutes % 60
    ).getTime();

    const dayEndMs = new Date(
      currentDay.getFullYear(),
      currentDay.getMonth(),
      currentDay.getDate(),
      Math.floor(workEndMinutes / 60),
      workEndMinutes % 60
    ).getTime();

    const dayStartTs = currentDay.getTime();
    const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;

    const dayBusy = busyBlocks.filter(b => {
      const bs = b.start.getTime();
      const be = b.end.getTime();
      return bs < dayEndTs && be > dayStartTs;
    });

    // With capacity > 1 (Granite-Epik double-booking), a time is only "blocked"
    // when at least `capacity` bookings overlap it, so a second tech can stack
    // on top of one existing booking. capacity === 1 == the original union merge.
    const merged =
      capacity > 1
        ? blockedByCapacity(dayBusy, capacity)
        : mergeBusyBlocks(dayBusy);
    const freeBlocks = computeFreeBlocksForDay(
      dayStartMs,
      dayEndMs,
      merged,
      bufferMs
    );

    allFreeBlocks.push(...freeBlocks);
  }

  allFreeBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
  return allFreeBlocks;
}

function parseWorkHours() {
  const [wsH, wsM] = CONFIG.TIME.WORK_START_TIME.split(":").map(Number);
  const [weH, weM] = CONFIG.TIME.WORK_END_TIME.split(":").map(Number);
  return {
    startMinutes: wsH * 60 + wsM,
    endMinutes: weH * 60 + weM,
  };
}

function mergeBusyBlocks(blocks) {
  const sorted = blocks
    .map(b => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const block of sorted) {
    if (merged.length === 0 || block.start > merged[merged.length - 1].end) {
      merged.push({ ...block });
    } else {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        block.end
      );
    }
  }
  return merged;
}

// Returns the intervals (ms) where at least `capacity` busy blocks overlap.
// A sweep line: +1 at each start, -1 at each end; regions with count >= capacity
// are blocked. At equal timestamps, ends are processed before starts so that
// touching intervals do not count as overlapping.
function blockedByCapacity(blocks, capacity) {
  const events = [];
  for (const b of blocks) {
    events.push({ t: b.start.getTime(), d: 1 });
    events.push({ t: b.end.getTime(), d: -1 });
  }
  events.sort((a, b) => a.t - b.t || a.d - b.d);

  const result = [];
  let count = 0;
  let blockedStart = null;
  for (const e of events) {
    const prev = count;
    count += e.d;
    if (prev < capacity && count >= capacity) {
      blockedStart = e.t;
    } else if (prev >= capacity && count < capacity) {
      result.push({ start: blockedStart, end: e.t });
      blockedStart = null;
    }
  }
  return result;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function computeFreeBlocksForDay(dayStart, dayEnd, mergedBusy, bufferMs) {
  const freeBlocks = [];
  let cursor = dayStart;

  for (const block of mergedBusy) {
    if (block.end <= cursor) continue;
    if (block.start >= dayEnd) break;

    const gapStart = cursor + (cursor === dayStart ? 0 : bufferMs);
    const gapEnd = block.start - bufferMs;

    if (gapEnd > gapStart) {
      freeBlocks.push({
        start: new Date(gapStart),
        end: new Date(gapEnd),
      });
    }

    cursor = Math.max(cursor, block.end);
  }

  const finalStart = cursor + (cursor === dayStart ? 0 : bufferMs);
  if (finalStart <= dayEnd) {
    freeBlocks.push({
      start: new Date(finalStart),
      end: new Date(dayEnd),
    });
  }

  return freeBlocks;
}

export async function getAvailableBlocks({
  date,
  daysToCheck = 7,
  withBusy = false,
  capacity = 1,
}) {
  let startDate;
  if (date instanceof Date) {
    startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  } else {
    const [y, m, d] = String(date).split("-").map(Number);
    startDate = new Date(y, m - 1, d);
  }

  const { startMinutes, endMinutes } = parseWorkHours();
  const bufferMs = CONFIG.TIME.BUFFER_MINUTES * 60 * 1000;

  const calendarBusyBlocks = await fetchCalendarBusy(startDate, daysToCheck);
  const wmBusyBlocks = CONFIG.WORKMARKET_SCHEDULE_CHECK_ENABLED
    ? await fetchWMBusy()
    : [];
  const fnBusyBlocks = await fetchFNBusy();

  const allBusyBlocks = [...calendarBusyBlocks, ...wmBusyBlocks, ...fnBusyBlocks];

  logger.info(
    `getAvailableBlocks: total ${allBusyBlocks.length} busy blocks (${calendarBusyBlocks.length} calendar + ${wmBusyBlocks.length} WM + ${fnBusyBlocks.length} FN), scanning ${daysToCheck} days from ${startDate.toDateString()}`
  );

  const allFreeBlocks = computeFreeBlocks({
    startDate,
    daysToCheck,
    busyBlocks: allBusyBlocks,
    workStartMinutes: startMinutes,
    workEndMinutes: endMinutes,
    bufferMinutes: CONFIG.TIME.BUFFER_MINUTES,
    capacity,
  });

  logger.info(
    `getAvailableBlocks: found ${allFreeBlocks.length} free blocks\n${allFreeBlocks.map((b, i) => `  ${i + 1}. ${b.start.toLocaleString()} - ${b.end.toLocaleString()}`).join("\n")}`
  );

  if (withBusy) {
    return { free: allFreeBlocks, busy: allBusyBlocks };
  }
  return allFreeBlocks;
}
