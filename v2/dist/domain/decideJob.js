import { calculateTravelExpense } from "./calculateTravelExpense.js";
import { evaluateAvailability } from "./evaluateAvailability.js";
function getPlatformMinimum(job, policy) {
    return job.platform === "WorkMarket"
        ? policy.workMarketMinTotal
        : policy.fieldNationMinTotal;
}
function getPlatformBaseRate(job, policy) {
    return job.platform === "WorkMarket"
        ? policy.workMarketBaseRate
        : policy.fieldNationBaseRate;
}
export function decideJob(job, policy, input) {
    const trace = [];
    const isGranite = job.company.trim().toLowerCase() === "granite telecommunications";
    trace.push({
        rule: "granite_only",
        matched: policy.graniteOnly && !isGranite,
        detail: isGranite ? "Granite job" : "Non-Granite job"
    });
    if (policy.graniteOnly && !isGranite) {
        return {
            type: "skip",
            reason: "POLICY_REJECTED",
            trace
        };
    }
    const totalBudget = job.compensation.totalBudget;
    const hourlyRate = job.compensation.hourlyRate ?? 0;
    const platformMinimum = getPlatformMinimum(job, policy);
    const baseRate = getPlatformBaseRate(job, policy);
    trace.push({
        rule: "minimum_total",
        matched: totalBudget < platformMinimum,
        detail: `Total budget ${totalBudget} vs minimum ${platformMinimum}`,
        values: {
            totalBudget,
            platformMinimum
        }
    });
    if (totalBudget < platformMinimum) {
        return {
            type: "skip",
            reason: "PAYMENT_BELOW_MINIMUM",
            trace,
            executionPlan: {
                action: "skip",
                platform: job.platform,
                payload: {
                    reason: "PAYMENT_BELOW_MINIMUM"
                }
            }
        };
    }
    const availability = evaluateAvailability(job.requestedWindow, policy.workingHours, input?.busyIntervals ?? []);
    trace.push({
        rule: "working_hours",
        matched: !availability.requestedSlotAvailable,
        detail: availability.detail,
        values: {
            withinWorkingHours: availability.withinWorkingHours,
            requestedSlotAvailable: availability.requestedSlotAvailable,
            hasSameDayCounterSlot: availability.hasSameDayCounterSlot,
            hasFutureCounterSlot: availability.hasFutureCounterSlot
        }
    });
    if (!availability.requestedSlotAvailable && !policy.counterDates) {
        const reason = availability.withinWorkingHours
            ? "SLOT_UNAVAILABLE"
            : "OUTSIDE_WORKING_HOURS";
        return {
            type: "skip",
            reason,
            trace,
            executionPlan: {
                action: "skip",
                platform: job.platform,
                payload: {
                    reason
                }
            }
        };
    }
    const rateTooLow = job.compensation.payType === "hourly" && hourlyRate > 0 && hourlyRate < baseRate;
    trace.push({
        rule: "base_rate",
        matched: rateTooLow,
        detail: `Hourly rate ${hourlyRate} vs base rate ${baseRate}`,
        values: {
            hourlyRate,
            baseRate
        }
    });
    const needsRateCounter = rateTooLow && policy.counterRates;
    const travelExpense = calculateTravelExpense(job.distanceMiles, policy.travel);
    const needsTravelCounter = travelExpense > 0;
    const needsDateCounter = !availability.requestedSlotAvailable && policy.counterDates;
    trace.push({
        rule: "travel_expense",
        matched: needsTravelCounter,
        detail: `Calculated travel expense ${travelExpense}`,
        values: {
            distanceMiles: job.distanceMiles,
            travelExpense
        }
    });
    trace.push({
        rule: "counter_shape",
        matched: needsDateCounter || needsRateCounter || needsTravelCounter,
        detail: `date=${needsDateCounter} rate=${needsRateCounter} travel=${needsTravelCounter}`,
        values: {
            needsDateCounter,
            needsRateCounter,
            needsTravelCounter
        }
    });
    if (needsDateCounter || needsRateCounter || needsTravelCounter) {
        const decisionType = needsDateCounter && (needsRateCounter || needsTravelCounter)
            ? "counter_both"
            : needsDateCounter
                ? "counter_date"
                : "counter_rate";
        const reason = needsDateCounter
            ? availability.withinWorkingHours
                ? "SLOT_UNAVAILABLE"
                : "OUTSIDE_WORKING_HOURS"
            : needsRateCounter
                ? "PAYMENT_INSUFFICIENT"
                : "TRAVEL_REQUIRED";
        const counterOffer = {
            hourlyRate: needsRateCounter ? baseRate : hourlyRate || undefined,
            travelExpense: needsTravelCounter ? travelExpense : undefined,
            counterStart: needsDateCounter
                ? availability.counterStart ?? availability.futureCounterStart
                : undefined,
            counterEnd: needsDateCounter
                ? availability.counterEnd ?? availability.futureCounterEnd
                : undefined,
            note: needsDateCounter ? "Counter date required" : undefined
        };
        return {
            type: decisionType,
            reason,
            trace,
            counterOffer,
            executionPlan: {
                action: "counter",
                platform: job.platform,
                payload: {
                    hourlyRate: counterOffer.hourlyRate,
                    travelExpense: counterOffer.travelExpense,
                    counterDateRequired: needsDateCounter,
                    counterStart: counterOffer.counterStart,
                    counterEnd: counterOffer.counterEnd
                }
            }
        };
    }
    return {
        type: "apply",
        reason: "ELIGIBLE",
        trace,
        executionPlan: {
            action: "apply",
            platform: job.platform,
            payload: {
                testMode: policy.testMode
            }
        }
    };
}
