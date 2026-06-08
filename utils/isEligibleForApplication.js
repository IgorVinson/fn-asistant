import { CONFIG } from "../config.js";
import logger from "./logger.js";
import { getAvailableBlocks } from "./availability/getAvailableBlocks.js";
import { findFitBlock } from "./availability/findFitBlock.js";
import { decideFitAction } from "./availability/decideFitAction.js";

function getWorkOrderLocalDate(workOrder) {
  const startDate = new Date(workOrder.time.start);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(startDate);
}

function isGraniteCompany(companyName) {
  return (companyName || "").trim().toLowerCase() === "granite telecommunications";
}

function getEtMinutes(dateLike) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "numeric",
    minute: "numeric",
  });

  const [hours, minutes] = formatter
    .format(new Date(dateLike))
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function evaluateApplicationPolicy(workOrder) {
  const workOrderDate = getWorkOrderLocalDate(workOrder);
  const mode = CONFIG.APPLICATION_MODE || "granite_only";
  const isGranite = isGraniteCompany(workOrder.company);
  const overrideDates = CONFIG.ALLOW_ALL_COMPANIES_ON_DATES || [];
  const isDateOverride = overrideDates.includes(workOrderDate);

  if (mode === "disabled") {
    return {
      allowed: false,
      reason: "MODE_DISABLED",
      details: "Application mode is disabled",
      workOrderDate,
    };
  }

  if (mode === "all_companies") {
    return {
      allowed: true,
      reason: "POLICY_ALLOWED_ALL_COMPANIES",
      details: "All companies are allowed by application mode",
      workOrderDate,
    };
  }

  if (mode === "granite_only") {
    if (isGranite) {
      return {
        allowed: true,
        reason: "POLICY_ALLOWED_GRANITE",
        details: "Granite job allowed by granite_only mode",
        workOrderDate,
      };
    }

    if (isDateOverride) {
      return {
        allowed: true,
        reason: "POLICY_ALLOWED_DATE_OVERRIDE",
        details: `Non-Granite job allowed on override date ${workOrderDate}`,
        workOrderDate,
      };
    }
  }

  return {
    allowed: false,
    reason: "POLICY_REJECTED",
    details:
      mode === "granite_only"
        ? `Non-Granite jobs are allowed only on override dates (${overrideDates.join(", ") || "none configured"})`
        : `Unsupported application mode: ${mode}`,
    workOrderDate,
  };
}

// Function to check if any requested start is within working hours.
function isWithinWorkingHours(startTime, timeWindow = {}) {
  const workStartTime = CONFIG.TIME.WORK_START_TIME;
  const workEndTime = CONFIG.TIME.WORK_END_TIME;

  const jobStart = new Date(startTime);
  const [workStartH, workStartM] = workStartTime.split(":").map(Number);
  const [workEndH, workEndM] = workEndTime.split(":").map(Number);
  const jobStartMinutes = getEtMinutes(startTime);
  const jobLatestStartMinutes = timeWindow.latestStart
    ? getEtMinutes(timeWindow.latestStart)
    : jobStartMinutes;
  const workStartMinutes = workStartH * 60 + workStartM;
  const workEndMinutes = workEndH * 60 + workEndM;

  // The start window is workable if it overlaps the configured workday.
  const isWithinHours =
    jobLatestStartMinutes >= workStartMinutes &&
    jobStartMinutes <= workEndMinutes;

  logger.info(
    `Working Hours Check:
    - Job Date (Local): ${jobStart.toLocaleDateString()}
    - Earliest Start (ET): ${String(Math.floor(jobStartMinutes / 60)).padStart(2, "0")}:${String(jobStartMinutes % 60).padStart(2, "0")}
    - Latest Start (ET): ${String(Math.floor(jobLatestStartMinutes / 60)).padStart(2, "0")}:${String(jobLatestStartMinutes % 60).padStart(2, "0")}
    - Work Hours: ${workStartTime} - ${workEndTime}
    - Within Hours: ${isWithinHours}`,
    "SCHEDULE_CHECK"
  );

  return isWithinHours;
}

function getBaseHourlyRate(platform) {
  const platformRate = platform === "FieldNation"
    ? CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION
    : CONFIG.RATES.BASE_HOURLY_RATE_WORKMARKET;
  return platformRate || CONFIG.RATES.BASE_HOURLY_RATE;
}

function isPaymentEligible(workOrder) {
  const isFieldNation = workOrder.platform === "FieldNation";
  const MIN_HOURLY_RATE = getBaseHourlyRate(workOrder.platform);
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const platformMinTotal = isFieldNation
    ? CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION
    : CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET;

  const isHourly = workOrder.payType === "hourly" || workOrder.hourlyRate > 0;

  // Calculate their offered total and hourly rate
  let theirTotal = 0;
  let theirRate = 0;
  if (isHourly) {
    theirRate = workOrder.hourlyRate || workOrder.payRange.min || 0;
    theirTotal = workOrder.payRange.max || (theirRate * estHours);
  } else {
    theirTotal = workOrder.payRange.max || 0;
    theirRate = theirTotal / (estHours || 1);
  }

  const effectiveDistance = (workOrder.distance || 0) + CONFIG.DISTANCE.DISTANCE_PADDING_MILES;
  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;
  const needsTravelCounter = effectiveDistance > TRAVEL_THRESHOLD;
  const travelDetails = needsTravelCounter
    ? `Travel required (${workOrder.distance}mi reported + ${CONFIG.DISTANCE.DISTANCE_PADDING_MILES}mi padding = ${effectiveDistance}mi > ${TRAVEL_THRESHOLD}mi)`
    : null;

  // RULE 1: If total pay is less than platform minimum -> ALWAYS REJECT (no counter)
  if (CONFIG.ENFORCE_MIN_PAYMENT && theirTotal < platformMinTotal) {
    const details = `Total pay $${theirTotal} is below platform minimum threshold $${platformMinTotal}`;
    logger.info(`Payment Analysis: ${details} -> REJECT`, workOrder.platform, workOrder.id);
    return { isAcceptable: false, issue: "BELOW_MINIMUM", details };
  }

  // RULE 2: Total pay is OK. But is the rate below BASE_HOURLY_RATE?
  if (theirRate < MIN_HOURLY_RATE) {
    const details = `Rate $${Math.round(theirRate)}/hr is below base rate $${MIN_HOURLY_RATE}/hr`;
    logger.info(
      `Payment Analysis: ${details} -> ${CONFIG.IS_COUNTER_RATES ? "COUNTER" : "REJECT"}`,
      workOrder.platform,
      workOrder.id
    );
    return { isAcceptable: false, issue: "LOW_RATE", details };
  }

  // RULE 3: Payment is good. How about travel?
  if (needsTravelCounter) {
    logger.info(
      `Payment Analysis: Pay OK, but ${travelDetails} -> COUNTER`,
      workOrder.platform,
      workOrder.id
    );
    return { isAcceptable: false, issue: "TRAVEL", details: travelDetails };
  }

  logger.info(
    `Payment Analysis: OK -> ACCEPT`,
    workOrder.platform,
    workOrder.id
  );
  return { isAcceptable: true, issue: null, details: "Pay and distance OK" };
}

function getJobDurationMs(workOrder) {
  return (workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS) * 60 * 60 * 1000;
}

function calculateTravelMinutes(workOrder) {
  const distance = workOrder.distance || 0;
  if (distance <= 0) return 0;
  const travelHours = distance / CONFIG.DISTANCE.AVERAGE_SPEED;
  return Math.round(travelHours * 60);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

async function checkAvailabilityNew(workOrder) {
  const woDateString = getWorkOrderLocalDate(workOrder);
  const availableBlocks = await getAvailableBlocks({ date: woDateString, daysToCheck: 4 });

  const travelMin = calculateTravelMinutes(workOrder);
  const durationMs = getJobDurationMs(workOrder);
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;

  const woEarliestStart = new Date(workOrder.time.start);
  const woLatestStart = workOrder.time.latestStart
    ? new Date(workOrder.time.latestStart)
    : new Date(workOrder.time.start);

  const [lcsH, lcsM] = CONFIG.TIME.LATEST_COUNTER_START_TIME.split(":").map(Number);
  const latestCounterStart = new Date(
    woEarliestStart.getFullYear(),
    woEarliestStart.getMonth(),
    woEarliestStart.getDate(),
    lcsH, lcsM
  );

  const sameDayBlocks = availableBlocks.filter(b => isSameDay(b.start, woEarliestStart));
  const nextDayBlocks = availableBlocks.filter(b => !isSameDay(b.start, woEarliestStart));

  const fitResult = findFitBlock(sameDayBlocks, {
    earliestStart: woEarliestStart,
    latestStart: woLatestStart,
    durationMs,
  }, travelMin);

  const shiftedSameDay = findFitBlock(sameDayBlocks, {
    earliestStart: woEarliestStart,
    latestStart: latestCounterStart,
    durationMs,
  }, travelMin);

  let shiftedResult = shiftedSameDay;
  if (!shiftedSameDay.fits && CONFIG.IS_COUNTER_DAYS && nextDayBlocks.length > 0) {
    shiftedResult = findFitBlock(nextDayBlocks, {
      earliestStart: new Date(0),
      latestStart: new Date(2099, 0, 1),
      durationMs,
    }, travelMin);
  }

  const shiftedBlock = shiftedResult.block;
  const shiftedIsLast = shiftedResult.isLastBlockOfDay;
  const shiftedEffDurationMin = shiftedResult.effectiveDurationMinutes;
  const fitDecision = decideFitAction({
    exactFit: fitResult,
    shiftedFit: shiftedResult,
  });

  console.log(`\n=== Availability Fit Check ===`);
  console.log(`WO Date: ${woDateString}`);
  console.log(`WO Window: ${woEarliestStart.toLocaleString()} — ${woLatestStart.toLocaleString()}`);
  console.log(`Duration: ${estHours}h, Distance: ${workOrder.distance}mi, Travel: ${travelMin}min one-way`);
  console.log(`Latest same-day counter start: ${latestCounterStart.toLocaleTimeString()}, IS_COUNTER_DAYS: ${CONFIG.IS_COUNTER_DAYS}`);
  console.log(`Available Blocks (${availableBlocks.length}): ${sameDayBlocks.length} today, ${nextDayBlocks.length} future`);
  availableBlocks.forEach((b, i) => console.log(`  ${i + 1}. ${b.start.toLocaleString()} — ${b.end.toLocaleString()}`));
  console.log(`Exact Fit: ${fitResult.fits}${fitResult.block ? ` → ${fitResult.block.start.toLocaleString()} — ${fitResult.block.end.toLocaleString()}` : " — NO FIT"}`);
  console.log(`Shifted Fit: ${shiftedResult.fits}${shiftedBlock ? ` → ${shiftedBlock.start.toLocaleString()} — ${shiftedBlock.end.toLocaleString()} (eff. ${shiftedEffDurationMin}min${shiftedIsLast ? ", last block — no return" : ", round-trip"})` : " — NO FIT"}`);
  console.log(`Fit Decision: ${fitDecision.action}${fitDecision.counterDate ? ` → ${fitDecision.counterDate.start.toLocaleString()} — ${fitDecision.counterDate.end.toLocaleString()} (${fitDecision.counterDate.durationMinutes}min start interval)` : ""}`);
  console.log(`================================\n`);

  return { fitResult, shiftedResult, fitDecision };
}

// Find free time slots on a given day based on busy blocks
function findFreeSlots(workOrderDate, busyBlocks, minDurationMinutes = 60) {
  const BUFFER = CONFIG.TIME.BUFFER_MINUTES * 60 * 1000;
  const [wsH, wsM] = CONFIG.TIME.WORK_START_TIME.split(":").map(Number);
  const [weH, weM] = CONFIG.TIME.WORK_END_TIME.split(":").map(Number);

  const dayStart = new Date(
    workOrderDate.getFullYear(), workOrderDate.getMonth(), workOrderDate.getDate(), wsH, wsM
  ).getTime();
  const dayEnd = new Date(
    workOrderDate.getFullYear(), workOrderDate.getMonth(), workOrderDate.getDate(), weH, weM
  ).getTime();

  // Sort busy blocks by start time and merge overlapping ones
  const sorted = [...busyBlocks]
    .map(b => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const block of sorted) {
    if (merged.length === 0 || block.start > merged[merged.length - 1].end) {
      merged.push({ ...block });
    } else {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, block.end);
    }
  }

  // Find gaps between busy blocks within work hours
  const freeSlots = [];
  let cursor = dayStart;

  for (const block of merged) {
    const gapStart = cursor + BUFFER;
    const gapEnd = block.start - BUFFER;
    if (gapEnd > gapStart && (gapEnd - gapStart) >= minDurationMinutes * 60 * 1000) {
      freeSlots.push({
        start: new Date(gapStart),
        end: new Date(gapEnd),
        durationMinutes: Math.round((gapEnd - gapStart) / (60 * 1000)),
      });
    }
    cursor = Math.max(cursor, block.end);
  }

  // Check gap after last event until end of work day
  const finalGapStart = cursor + BUFFER;
  if (finalGapStart < dayEnd && (dayEnd - finalGapStart) >= minDurationMinutes * 60 * 1000) {
    freeSlots.push({
      start: new Date(finalGapStart),
      end: new Date(dayEnd),
      durationMinutes: Math.round((dayEnd - finalGapStart) / (60 * 1000)),
    });
  }

  logger.info(
    `Free Slots Found: ${freeSlots.length}
    ${freeSlots.map((s, i) => `  ${i + 1}. ${s.start.toLocaleTimeString()} - ${s.end.toLocaleTimeString()} (${s.durationMinutes} min)`).join("\n    ")}`,
    "COUNTER_DATES"
  );

  return freeSlots;
}

function calculateCounterOffer(workOrder) {
  const MIN_HOURLY_RATE = getBaseHourlyRate(workOrder.platform);
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;

  // Travel rules:
  // - When FLAT_TRAVEL > 0, it is a universal minimum floor.
  // - When FLAT_TRAVEL <= 0, travel only applies after crossing the threshold.
  const effectiveDistance = (workOrder.distance || 0) + CONFIG.DISTANCE.DISTANCE_PADDING_MILES;
  let travelExpense = 0;
  const mileageTravel = Math.round(
    effectiveDistance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE
  );

  if (CONFIG.FLAT_TRAVEL > 0) {
    travelExpense = Math.max(mileageTravel, CONFIG.FLAT_TRAVEL);
  } else if (effectiveDistance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES) {
    travelExpense = mileageTravel;
  }

  const roundTo = CONFIG.DISTANCE.TRAVEL_ROUND_TO || 1;
  if (travelExpense > 0 && roundTo > 1) {
    travelExpense = Math.ceil(travelExpense / roundTo) * roundTo;
  }

  // Determine pay type from order data
  const isBlended =
    workOrder.payType === "blended" &&
    workOrder.payStructure?.base &&
    workOrder.payStructure?.additional;
  const isHourly =
    !isBlended &&
    (workOrder.payType === "hourly" || workOrder.hourlyRate > 0);

  let counterRate;
  let counterTotal;
  let payType;

  let counterPayStructure = null;
  if (isBlended) {
    // Keep the buyer's blended SHAPE (type + base/additional units), but apply
    // our rate to the amounts. base.amount is a total for base.units hours;
    // additional.amount is a per-hour rate.
    payType = "blended";
    const { base, additional } = workOrder.payStructure;
    const baseUnits = parseInt(base.units) || 0;
    const addUnits = parseInt(additional.units) || 0;
    const theirBaseRate = baseUnits ? base.amount / baseUnits : 0;
    const theirAddRate = parseFloat(additional.amount) || 0;
    const theirRate = Math.max(theirBaseRate, theirAddRate);
    counterRate = Math.max(theirRate, MIN_HOURLY_RATE);
    counterPayStructure = {
      type: "blended",
      base: { units: baseUnits, amount: Math.round(counterRate * baseUnits) },
      additional: { units: addUnits, amount: counterRate },
    };
    counterTotal = counterPayStructure.base.amount + addUnits * counterRate;
  } else if (isHourly) {
    payType = "hourly";
    const theirRate = workOrder.hourlyRate || workOrder.payRange.min || 0;
    counterRate = Math.max(theirRate, MIN_HOURLY_RATE);
    counterTotal = Math.round(counterRate * estHours);
  } else {
    payType = "fixed";
    const theirAmount = workOrder.payRange.max || 0;
    const minTotal = MIN_HOURLY_RATE * estHours;
    counterTotal = Math.max(theirAmount, minTotal);
    counterRate = Math.round(counterTotal / estHours);
  }

  logger.info(
    `Counter offer generated: Type: ${payType}, Rate: $${counterRate}/hr × ${estHours}hrs = $${counterTotal} + Travel: $${travelExpense} (distance ${workOrder.distance}mi, effective ${effectiveDistance}mi)`,
    workOrder.platform,
    workOrder.id
  );

  return {
    shouldCounterOffer: true,
    payType: payType,
    counterRate: counterRate,
    baseAmount: counterTotal,
    estHours: estHours,
    travelExpense: travelExpense,
    // Rate-adjusted blended shape the FieldNation poster mirrors into pay.
    payStructure: counterPayStructure,
  };
}

async function isEligibleForApplication(workOrder) {
  logger.info(
    `Checking eligibility - Distance: ${workOrder.distance}mi, Est. Hours: ${workOrder.estLaborHours}`,
    workOrder.platform,
    workOrder.id
  );

  const woStartMs = new Date(workOrder.time.start).getTime();
  if (Number.isFinite(woStartMs) && woStartMs < Date.now()) {
    const details = `Requested start ${new Date(woStartMs).toLocaleString()} is in the past`;
    logger.info(`Job skipped: ${details}`, workOrder.platform, workOrder.id);
    return {
      eligible: false,
      counterOffer: null,
      reason: "WO_IN_PAST",
      rejectDetails: details,
    };
  }

  const policyCheck = evaluateApplicationPolicy(workOrder);
  logger.info(
    `Application Policy Check:
    - Mode: ${CONFIG.APPLICATION_MODE}
    - Company: ${workOrder.company}
    - Work Order Date: ${policyCheck.workOrderDate}
    - Result: ${policyCheck.reason}
    - Allowed: ${policyCheck.allowed}`,
    workOrder.platform,
    workOrder.id
  );

  if (!policyCheck.allowed) {
    logger.info(
      `Job rejected by application policy: ${policyCheck.details}`,
      workOrder.platform,
      workOrder.id
    );
    return {
      eligible: false,
      counterOffer: null,
      reason: policyCheck.reason,
      rejectDetails: policyCheck.details,
      policyReason: policyCheck.reason,
      workOrderDate: policyCheck.workOrderDate,
    };
  }

  const isInWorkingHours = isWithinWorkingHours(
    workOrder.time.start,
    workOrder.time
  );

  // Outside-hours jobs may still counter with an in-hours slot if enabled.
  if (!isInWorkingHours) {
    if (!CONFIG.IS_COUNTER_DATES) {
      logger.info(
        `Job rejected: Outside working hours (${CONFIG.TIME.WORK_START_TIME}-${CONFIG.TIME.WORK_END_TIME})`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null,
        reason: "OUTSIDE_WORKING_HOURS",
      };
    }
  }

  if (
    workOrder.platform === "FieldNation" ||
    workOrder.platform === "WorkMarket"
  ) {
    // STEP 1: Payment first — BELOW_MINIMUM auto-rejects regardless of availability.
    const paymentCheck = isPaymentEligible(workOrder);

    if (!paymentCheck.isAcceptable && paymentCheck.issue === "BELOW_MINIMUM") {
      logger.info(
        `Job rejected: Payment below minimum threshold - ${paymentCheck.details}. Rejecting without counter.`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null,
        reason: "PAYMENT_BELOW_MINIMUM",
        rejectDetails: paymentCheck.details,
      };
    }

    // STEP 2: Availability fit (exact, then shifted same-day, then next-day if enabled).
    let availabilityFitResult;
    try {
      availabilityFitResult = await checkAvailabilityNew(workOrder);
    } catch (err) {
      logger.info(`Availability fit check failed: ${err.message}`, workOrder.platform, workOrder.id);
      return {
        eligible: false,
        counterOffer: null,
        reason: "SLOT_UNAVAILABLE",
        rejectDetails: err.message,
      };
    }

    const availabilityFitDecision = availabilityFitResult.fitDecision;

    if (availabilityFitDecision.action === "COUNTER_DATES") {
      if (CONFIG.IS_COUNTER_DATES) {
        logger.info(
          `Shifted fit found - countering with start interval: ${availabilityFitDecision.counterDate.start.toLocaleTimeString()} - ${availabilityFitDecision.counterDate.end.toLocaleTimeString()}`,
          workOrder.platform,
          workOrder.id
        );
        const counterOffer = calculateCounterOffer(workOrder);
        counterOffer.counterDate = availabilityFitDecision.counterDate;
        return {
          eligible: false,
          counterOffer,
          reason: "COUNTER_DATES",
        };
      }

      logger.info(
        `Job rejected: Shifted fit found but counter dates are disabled`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null,
        reason: "SLOT_UNAVAILABLE",
      };
    }

    if (availabilityFitDecision.action === "NO_FIT") {
      logger.info(
        `Job rejected: No exact or shifted availability fit found`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null,
        reason: isInWorkingHours ? "SLOT_UNAVAILABLE" : "OUTSIDE_WORKING_HOURS",
      };
    }

    if (paymentCheck.isAcceptable) {
      return {
        eligible: true,
        counterOffer: null,
        reason: "ELIGIBLE",
      };
    }

    if (paymentCheck.issue === "LOW_RATE") {
      const willCounter = CONFIG.IS_COUNTER_RATES;
      logger.info(
        `Job rejected: Rate too low - ${paymentCheck.details}. ${willCounter ? "Generating counter offer." : "IS_COUNTER_RATES is false, rejecting without counter."}`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: willCounter ? calculateCounterOffer(workOrder) : null,
        reason: "PAYMENT_INSUFFICIENT",
        rejectDetails: paymentCheck.details,
      };
    }

    if (paymentCheck.issue === "TRAVEL") {
      logger.info(
        `Job rejected: Travel required - ${paymentCheck.details}. Generating counter offer with travel.`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: calculateCounterOffer(workOrder),
        reason: "TRAVEL_REQUIRED",
        rejectDetails: paymentCheck.details,
      };
    }
  }

  // Unknown platform
  logger.info(
    `Unknown platform: ${workOrder.platform}`,
    workOrder.platform,
    workOrder.id
  );

  return {
    eligible: false,
    counterOffer: null,
    reason: "UNKNOWN_PLATFORM",
  };
}

export default isEligibleForApplication;
export {
  calculateCounterOffer,
  evaluateApplicationPolicy,
  findFreeSlots,
  getWorkOrderLocalDate,
  isGraniteCompany,
};
