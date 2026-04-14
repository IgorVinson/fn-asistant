function parseClockToMinutes(value) {
    const [hours = 0, minutes = 0] = value.split(":").map(Number);
    return hours * 60 + minutes;
}
function dateToMinutes(value) {
    const date = new Date(value);
    return date.getHours() * 60 + date.getMinutes();
}
function buildIsoWithOriginalOffset(referenceIso, minutes) {
    const dateMatch = referenceIso.match(/^(\d{4}-\d{2}-\d{2})T/);
    const offsetMatch = referenceIso.match(/([+-]\d{2}:\d{2}|Z)$/);
    if (!dateMatch) {
        throw new Error(`Invalid ISO datetime: ${referenceIso}`);
    }
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    return `${dateMatch[1]}T${hours}:${mins}:00${offsetMatch?.[1] ?? "Z"}`;
}
function buildIsoOnFutureDay(referenceIso, minutes, daysToAdd) {
    const date = new Date(referenceIso);
    date.setDate(date.getDate() + daysToAdd);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const offsetMatch = referenceIso.match(/([+-]\d{2}:\d{2}|Z)$/);
    const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mins = String(minutes % 60).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${mins}:00${offsetMatch?.[1] ?? "Z"}`;
}
function normalizeBusyIntervals(busyIntervals, bufferMinutes) {
    return busyIntervals
        .map(interval => ({
        start: dateToMinutes(interval.start) - bufferMinutes,
        end: dateToMinutes(interval.end) + bufferMinutes
    }))
        .sort((left, right) => left.start - right.start);
}
function findEarliestFeasibleStart(startMinutes, endMinutes, durationMinutes, blockedIntervals) {
    if (startMinutes > endMinutes) {
        return undefined;
    }
    let candidate = startMinutes;
    for (const blocked of blockedIntervals) {
        if (blocked.end <= candidate) {
            continue;
        }
        if (candidate + durationMinutes <= blocked.start) {
            return candidate <= endMinutes ? candidate : undefined;
        }
        if (candidate < blocked.end) {
            candidate = blocked.end;
            if (candidate > endMinutes) {
                return undefined;
            }
        }
    }
    return candidate + durationMinutes <= endMinutes + durationMinutes
        ? candidate <= endMinutes
            ? candidate
            : undefined
        : undefined;
}
export function evaluateAvailability(requestedWindow, workingHours, busyIntervals = []) {
    const requestedStart = requestedWindow.earliestStart;
    const latestStart = requestedWindow.latestStart ?? requestedWindow.earliestStart;
    const requestedStartMinutes = dateToMinutes(requestedStart);
    const latestStartMinutes = dateToMinutes(latestStart);
    const workdayStartMinutes = parseClockToMinutes(workingHours.start);
    const workdayEndMinutes = parseClockToMinutes(workingHours.end);
    const durationMinutes = Math.round(requestedWindow.durationHours * 60);
    const latestAllowedStartInWorkday = workdayEndMinutes - durationMinutes;
    const blockedIntervals = normalizeBusyIntervals(busyIntervals, workingHours.bufferMinutes);
    const requestedWindowStart = Math.max(requestedStartMinutes, workdayStartMinutes);
    const requestedWindowEnd = Math.min(latestStartMinutes, latestAllowedStartInWorkday);
    const withinWorkingHours = requestedWindowStart <= requestedWindowEnd;
    const requestedStartCandidate = findEarliestFeasibleStart(requestedWindowStart, requestedWindowEnd, durationMinutes, blockedIntervals);
    const requestedSlotAvailable = requestedStartCandidate !== undefined;
    let feasibleRequestedStart;
    let feasibleRequestedEnd;
    if (requestedStartCandidate !== undefined) {
        feasibleRequestedStart = buildIsoWithOriginalOffset(requestedStart, requestedStartCandidate);
        feasibleRequestedEnd = buildIsoWithOriginalOffset(requestedStart, requestedStartCandidate + durationMinutes);
    }
    const counterStartCandidate = requestedSlotAvailable
        ? undefined
        : findEarliestFeasibleStart(Math.max(requestedStartMinutes, workdayStartMinutes), latestAllowedStartInWorkday, durationMinutes, blockedIntervals);
    const hasSameDayCounterSlot = counterStartCandidate !== undefined;
    const hasFutureCounterSlot = !requestedSlotAvailable &&
        !hasSameDayCounterSlot &&
        workdayStartMinutes <= latestAllowedStartInWorkday;
    return {
        withinWorkingHours,
        requestedSlotAvailable,
        hasSameDayCounterSlot,
        hasFutureCounterSlot,
        requestedStart,
        latestStart,
        workdayStart: workingHours.start,
        workdayEnd: workingHours.end,
        feasibleRequestedStart,
        feasibleRequestedEnd,
        counterStart: counterStartCandidate !== undefined
            ? buildIsoWithOriginalOffset(requestedStart, counterStartCandidate)
            : undefined,
        counterEnd: counterStartCandidate !== undefined
            ? buildIsoWithOriginalOffset(requestedStart, counterStartCandidate + durationMinutes)
            : undefined,
        futureCounterStart: hasFutureCounterSlot
            ? buildIsoOnFutureDay(requestedStart, workdayStartMinutes, 1)
            : undefined,
        futureCounterEnd: hasFutureCounterSlot
            ? buildIsoOnFutureDay(requestedStart, workdayStartMinutes + durationMinutes, 1)
            : undefined,
        detail: `Earliest ${requestedStart}, latest ${latestStart}, workday ${workingHours.start}-${workingHours.end}, duration ${requestedWindow.durationHours}h, busy=${busyIntervals.length}`
    };
}
