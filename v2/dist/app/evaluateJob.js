import { evaluateAvailability } from "../domain/evaluateAvailability.js";
import { decideJob } from "../domain/decideJob.js";
function shiftIsoByDays(referenceIso, daysToAdd) {
    const date = new Date(referenceIso);
    date.setDate(date.getDate() + daysToAdd);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const timeMatch = referenceIso.match(/T(\d{2}:\d{2}:\d{2})/);
    const offsetMatch = referenceIso.match(/([+-]\d{2}:\d{2}|Z)$/);
    return `${year}-${month}-${day}T${timeMatch?.[1] ?? "00:00:00"}${offsetMatch?.[1] ?? "Z"}`;
}
function shiftRequestedWindow(requestedWindow, daysToAdd) {
    const shiftedRequestedDate = new Date(requestedWindow.requestedDate);
    shiftedRequestedDate.setDate(shiftedRequestedDate.getDate() + daysToAdd);
    return {
        ...requestedWindow,
        earliestStart: shiftIsoByDays(requestedWindow.earliestStart, daysToAdd),
        latestStart: requestedWindow.latestStart
            ? shiftIsoByDays(requestedWindow.latestStart, daysToAdd)
            : undefined,
        requestedDate: shiftedRequestedDate.toISOString().slice(0, 10)
    };
}
function createFutureCounterWindow(requestedWindow, daysToAdd, workdayStart, workdayEnd) {
    const shifted = shiftRequestedWindow(requestedWindow, daysToAdd);
    const workdayEndMinutes = (() => {
        const [hours = 0, minutes = 0] = workdayEnd.split(":").map(Number);
        return hours * 60 + minutes;
    })();
    const durationMinutes = Math.round(requestedWindow.durationHours * 60);
    const latestStartMinutes = Math.max(0, workdayEndMinutes - durationMinutes);
    const latestHours = String(Math.floor(latestStartMinutes / 60)).padStart(2, "0");
    const latestMinutes = String(latestStartMinutes % 60).padStart(2, "0");
    const datePart = shifted.earliestStart.slice(0, 10);
    const offsetPart = shifted.earliestStart.match(/([+-]\d{2}:\d{2}|Z)$/)?.[1] ?? "Z";
    return {
        ...shifted,
        earliestStart: `${datePart}T${workdayStart}:00${offsetPart}`,
        latestStart: `${datePart}T${latestHours}:${latestMinutes}:00${offsetPart}`,
        isFlexible: true
    };
}
function isWeekend(anchorIso) {
    const date = new Date(anchorIso);
    const day = date.getDay();
    return day === 0 || day === 6;
}
export async function evaluateJob(job, policy, calendarProvider) {
    const busyIntervals = await calendarProvider.getBusyIntervalsForJob(job);
    const initialAvailability = evaluateAvailability(job.requestedWindow, policy.workingHours, busyIntervals);
    let decision = decideJob(job, policy, { busyIntervals });
    let slotStrategy = initialAvailability.requestedSlotAvailable
        ? "requested_slot"
        : initialAvailability.hasSameDayCounterSlot
            ? "same_day_counter"
            : "no_slot";
    let daysShifted = 0;
    if (policy.counterDates &&
        decision.executionPlan?.action === "counter" &&
        decision.counterOffer &&
        !initialAvailability.requestedSlotAvailable &&
        !initialAvailability.hasSameDayCounterSlot) {
        for (let dayOffset = 1; dayOffset <= policy.futureCounterSearchDays; dayOffset += 1) {
            const shiftedWindow = createFutureCounterWindow(job.requestedWindow, dayOffset, policy.workingHours.start, policy.workingHours.end);
            if (isWeekend(shiftedWindow.earliestStart)) {
                continue;
            }
            const futureBusyIntervals = await calendarProvider.getBusyIntervalsForDate(shiftedWindow.earliestStart);
            const futureAvailability = evaluateAvailability(shiftedWindow, policy.workingHours, futureBusyIntervals);
            if (futureAvailability.requestedSlotAvailable ||
                futureAvailability.hasSameDayCounterSlot) {
                const counterStart = futureAvailability.feasibleRequestedStart ??
                    futureAvailability.counterStart;
                const counterEnd = futureAvailability.feasibleRequestedEnd ??
                    futureAvailability.counterEnd;
                decision = {
                    ...decision,
                    counterOffer: {
                        ...decision.counterOffer,
                        counterStart,
                        counterEnd
                    },
                    executionPlan: decision.executionPlan
                        ? {
                            ...decision.executionPlan,
                            payload: {
                                ...decision.executionPlan.payload,
                                counterStart,
                                counterEnd
                            }
                        }
                        : decision.executionPlan
                };
                slotStrategy = "future_day_counter";
                daysShifted = dayOffset;
                break;
            }
        }
    }
    if (slotStrategy === "no_slot" && decision.counterOffer?.counterStart) {
        slotStrategy = "future_day_counter";
        daysShifted = 1;
    }
    return {
        busyIntervals,
        decision,
        evaluationContext: {
            calendarProvider: calendarProvider.name,
            evaluatedAt: new Date().toISOString(),
            busyIntervals,
            slotStrategy,
            daysShifted
        }
    };
}
