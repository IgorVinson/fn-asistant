import { CONFIG } from "../config.js";
import logger from "./logger.js";
import { fetchWMAssignments } from "./WorkMarket/getWMAssignments.js";

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

function isPaymentEligible(workOrder) {
  const isFieldNation = workOrder.platform === "FieldNation";
  const MIN_HOURLY_RATE = isFieldNation 
    ? (CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION || CONFIG.RATES.BASE_HOURLY_RATE)
    : (CONFIG.RATES.BASE_HOURLY_RATE_WORKMARKET || CONFIG.RATES.BASE_HOURLY_RATE);
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

  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;
  const needsTravelCounter = workOrder.distance > TRAVEL_THRESHOLD;
  const travelDetails = needsTravelCounter ? `Travel required (${workOrder.distance}mi > ${TRAVEL_THRESHOLD}mi)` : null;

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

function getRequestedStartWindow(workOrder, targetDate = null) {
  const requestedStart = new Date(workOrder.time.start);
  const requestedLatestStart = workOrder.time.latestStart
    ? new Date(workOrder.time.latestStart)
    : new Date(workOrder.time.start);

  if (!targetDate) {
    return {
      earliestStart: requestedStart,
      latestStart: requestedLatestStart,
    };
  }

  const sameRequestedDay =
    requestedStart.getFullYear() === targetDate.getFullYear() &&
    requestedStart.getMonth() === targetDate.getMonth() &&
    requestedStart.getDate() === targetDate.getDate();

  if (sameRequestedDay) {
    return {
      earliestStart: requestedStart,
      latestStart: requestedLatestStart,
    };
  }

  const [wsH, wsM] = CONFIG.TIME.WORK_START_TIME.split(":").map(Number);
  const [weH, weM] = CONFIG.TIME.WORK_END_TIME.split(":").map(Number);

  return {
    earliestStart: new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      wsH,
      wsM
    ),
    latestStart: new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      weH,
      weM
    ),
  };
}

// New function using Google Calendar for availability checking
async function isSlotAvailableCalendar(workOrder, externalBusyBlocks = []) {
  const MIN_BUFFER_MINUTES = CONFIG.TIME.BUFFER_MINUTES;
  const { start: startTime, end: endTime } = workOrder.time;

  try {
    // Use the same simple approach as showAllCalendarsEvents.js
    const { authorize } = await import("./gmail/login.js");
    const { google } = await import("googleapis");

    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    // Get work order time details with proper date handling
    const workOrderStart = new Date(startTime);
    const workOrderEnd = new Date(endTime);

    // Get the work order date in local time zone
    const workOrderDate = new Date(
      workOrderStart.getFullYear(),
      workOrderStart.getMonth(),
      workOrderStart.getDate()
    );

    // Get all calendars
    const calendarList = await calendar.calendarList.list();
    const allCalendars = calendarList.data.items || [];

    logger.info(
      `Multi-Calendar Check: Found ${allCalendars.length} calendars to check for conflicts`,
      workOrder.platform,
      workOrder.id
    );

    let totalEvents = 0;
    let totalConflicts = 0;
    const conflicts = [];
    const allBusyBlocks = [];

    // Get the date range for the work order day (start of day to end of day)
    const timeMin = new Date(workOrderDate).toISOString();
    const timeMax = new Date(
      workOrderDate.getFullYear(),
      workOrderDate.getMonth(),
      workOrderDate.getDate() + 1
    ).toISOString();

    // Check each calendar for conflicts
    for (const cal of allCalendars) {
      try {
        const events = await calendar.events.list({
          calendarId: cal.id,
          timeMin: timeMin,
          timeMax: timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });

        const todayEvents = events.data.items || [];
        totalEvents += todayEvents.length;

        // Check each event for conflicts
        for (const event of todayEvents) {
          // Skip cancelled or transparent (free) events
          if (
            event.status === "cancelled" ||
            event.transparency === "transparent"
          ) {
            continue;
          }

          // Handle both dateTime and date formats properly
          let eventStart, eventEnd;

          if (event.start.dateTime) {
            eventStart = new Date(event.start.dateTime);
          } else if (event.start.date) {
            // All-day events - use the full day
            eventStart = new Date(event.start.date + "T00:00:00");
          } else {
            continue; // Skip invalid events
          }

          if (event.end.dateTime) {
            eventEnd = new Date(event.end.dateTime);
          } else if (event.end.date) {
            // All-day events - end at start of next day
            eventEnd = new Date(event.end.date + "T00:00:00");
          } else {
            continue; // Skip invalid events
          }

          // Collect busy block for free slot calculation
          allBusyBlocks.push({ start: eventStart, end: eventEnd, summary: event.summary || "Busy" });

          // Add buffer time to work order times
          const bufferedWorkStart = new Date(
            workOrderStart.getTime() - MIN_BUFFER_MINUTES * 60 * 1000
          );
          const bufferedWorkEnd = new Date(
            workOrderEnd.getTime() + MIN_BUFFER_MINUTES * 60 * 1000
          );

          // Check for overlap
          if (bufferedWorkStart < eventEnd && bufferedWorkEnd > eventStart) {
            conflicts.push({
              eventSummary: event.summary || "No title",
              calendarName: cal.summary,
              eventStart: eventStart.toLocaleString(),
              eventEnd: eventEnd.toLocaleString(),
              workOrderStart: workOrderStart.toLocaleString(),
              workOrderEnd: workOrderEnd.toLocaleString(),
            });
            totalConflicts++;
          }
        }
      } catch (error) {
        logger.info(
          `Could not check calendar "${cal.summary}": ${error.message}`,
          workOrder.platform,
          workOrder.id
        );
      }
    }

    // Merge external busy blocks (e.g. existing WM assignments)
    for (const block of externalBusyBlocks) {
      allBusyBlocks.push({
        start: block.start,
        end: block.end,
        summary: block.summary || "Busy (external)",
      });
    }

    const requestedSlot = findFeasibleSlot(workOrderDate, allBusyBlocks, workOrder, {
      allowShift: false,
    });
    const counterSlot = findFeasibleSlot(workOrderDate, allBusyBlocks, workOrder, {
      allowShift: true,
    });
    const isAvailable = Boolean(requestedSlot);

    logger.info(
      `Calendar Availability Check:
      - Work Order Date: ${workOrderDate.toDateString()}
      - Work Order Time: ${workOrderStart.toLocaleTimeString()} - ${workOrderEnd.toLocaleTimeString()}
      - Buffer: ${MIN_BUFFER_MINUTES} minutes
      - Calendars Checked: ${allCalendars.length}
      - Total Events Found: ${totalEvents}
      - Conflicts Found: ${totalConflicts}
      - Requested Slot Available: ${requestedSlot ? `${requestedSlot.start.toLocaleTimeString()} - ${requestedSlot.end.toLocaleTimeString()}` : "NO"}
      - Counter Slot Available: ${counterSlot ? `${counterSlot.start.toLocaleTimeString()} - ${counterSlot.end.toLocaleTimeString()}` : "NO"}
      - Decision: ${isAvailable ? "AVAILABLE" : "CONFLICT"}`,
      workOrder.platform,
      workOrder.id
    );

    if (!isAvailable && conflicts.length > 0) {
      logger.info(
        `Calendar conflicts details:
        ${conflicts
          .map(
            (conflict, index) =>
              `  ${index + 1}. "${conflict.eventSummary}" [${
                conflict.calendarName
              }]
              Event: ${conflict.eventStart} - ${conflict.eventEnd}
              Work Order: ${conflict.workOrderStart} - ${conflict.workOrderEnd}`
          )
          .join("\n        ")}`,
        workOrder.platform,
        workOrder.id
      );
    }

    return {
      isAvailable,
      busyBlocks: allBusyBlocks,
      workOrderDate,
      requestedSlot,
      counterSlot,
    };
  } catch (error) {
    logger.error(
      `Error checking calendar availability: ${error.message}. Falling back to static schedule.`,
      workOrder.platform,
      workOrder.id
    );

    return {
      isAvailable: false,
      busyBlocks: [],
      workOrderDate: null,
      requestedSlot: null,
      counterSlot: null,
    };
  }
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

function findFeasibleSlot(workOrderDate, busyBlocks, workOrder, options = {}) {
  const durationMs = getJobDurationMs(workOrder);
  const durationMinutes = Math.round(durationMs / (60 * 1000));
  const freeSlots = findFreeSlots(workOrderDate, busyBlocks, durationMinutes);

  if (freeSlots.length === 0) {
    return null;
  }

  const { allowShift = false } = options;
  const requestedWindow = getRequestedStartWindow(workOrder, workOrderDate);
  const earliestAllowedMs = requestedWindow.earliestStart.getTime();
  const latestAllowedMs = allowShift
    ? Number.POSITIVE_INFINITY
    : requestedWindow.latestStart.getTime();

  for (const slot of freeSlots) {
    const candidateStartMs = Math.max(slot.start.getTime(), earliestAllowedMs);
    const latestSlotStartMs = slot.end.getTime() - durationMs;
    const effectiveLatestStartMs = Math.min(latestSlotStartMs, latestAllowedMs);

    if (candidateStartMs <= effectiveLatestStartMs) {
      return {
        start: new Date(candidateStartMs),
        end: new Date(candidateStartMs + durationMs),
        durationMinutes,
      };
    }
  }

  return null;
}

// Search upcoming days (up to maxDays) for a free slot via Google Calendar
async function findNextAvailableDay(workOrder, maxDays = 7, externalBusyBlocks = []) {
  try {
    const { authorize } = await import("./gmail/login.js");
    const { google } = await import("googleapis");
    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    const calendarList = await calendar.calendarList.list();
    const allCalendars = calendarList.data.items || [];

    const startDate = new Date(workOrder.time.start);

    for (let dayOffset = 1; dayOffset <= maxDays; dayOffset++) {
      const checkDate = new Date(
        startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayOffset
      );

      // Skip weekends
      const dow = checkDate.getDay();
      if (dow === 0 || dow === 6) continue;

      const timeMin = new Date(checkDate).toISOString();
      const timeMax = new Date(
        checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate() + 1
      ).toISOString();

      const busyBlocks = [];

      for (const cal of allCalendars) {
        try {
          const events = await calendar.events.list({
            calendarId: cal.id,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
          });

          for (const event of (events.data.items || [])) {
            if (event.status === "cancelled" || event.transparency === "transparent") continue;

            let eventStart, eventEnd;
            if (event.start.dateTime) {
              eventStart = new Date(event.start.dateTime);
            } else if (event.start.date) {
              eventStart = new Date(event.start.date + "T00:00:00");
            } else continue;

            if (event.end.dateTime) {
              eventEnd = new Date(event.end.dateTime);
            } else if (event.end.date) {
              eventEnd = new Date(event.end.date + "T00:00:00");
            } else continue;

            busyBlocks.push({ start: eventStart, end: eventEnd, summary: event.summary || "Busy" });
          }
        } catch (e) {
          // skip calendar errors
        }
      }

      // Merge external busy blocks (e.g. existing WM assignments) for this day
      for (const block of externalBusyBlocks) {
        const blockDate = new Date(block.start);
        if (
          blockDate.getFullYear() === checkDate.getFullYear() &&
          blockDate.getMonth() === checkDate.getMonth() &&
          blockDate.getDate() === checkDate.getDate()
        ) {
          busyBlocks.push({ start: block.start, end: block.end, summary: block.summary || "Busy (external)" });
        }
      }

      const bestSlot = findFeasibleSlot(checkDate, busyBlocks, workOrder, {
        allowShift: true,
      });

      if (bestSlot) {
        logger.info(
          `Next available day: ${checkDate.toDateString()} with slot ${bestSlot.start.toLocaleTimeString()} - ${bestSlot.end.toLocaleTimeString()}`,
          workOrder.platform,
          workOrder.id
        );
        return { date: checkDate, bestSlot };
      }
    }

    logger.info(
      `No available day found in the next ${maxDays} weekdays`,
      workOrder.platform,
      workOrder.id
    );
    return null;
  } catch (error) {
    logger.error(
      `Error searching for next available day: ${error.message}`,
      workOrder.platform,
      workOrder.id
    );
    return null;
  }
}

function calculateCounterOffer(workOrder) {
  const isFieldNation = workOrder.platform === "FieldNation";
  const MIN_HOURLY_RATE = isFieldNation 
    ? (CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION || CONFIG.RATES.BASE_HOURLY_RATE)
    : (CONFIG.RATES.BASE_HOURLY_RATE_WORKMARKET || CONFIG.RATES.BASE_HOURLY_RATE);
    
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;

  // Travel rules:
  // - When FLAT_TRAVEL > 0, it is a universal minimum floor.
  // - When FLAT_TRAVEL <= 0, travel only applies after crossing the threshold.
  let travelExpense = 0;
  const mileageTravel = Math.round(
    workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE
  );

  if (CONFIG.FLAT_TRAVEL > 0) {
    travelExpense = Math.max(mileageTravel, CONFIG.FLAT_TRAVEL);
  } else if (workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES) {
    travelExpense = mileageTravel;
  }

  // Determine pay type from order data
  const isHourly = workOrder.payType === "hourly" || workOrder.hourlyRate > 0;

  let counterRate;
  let counterTotal;

  if (isHourly) {
    const theirRate = workOrder.hourlyRate || workOrder.payRange.min || 0;
    counterRate = Math.max(theirRate, MIN_HOURLY_RATE);
    counterTotal = Math.round(counterRate * estHours);
  } else {
    const theirAmount = workOrder.payRange.max || 0;
    const minTotal = MIN_HOURLY_RATE * estHours;
    counterTotal = Math.max(theirAmount, minTotal);
    counterRate = Math.round(counterTotal / estHours);
  }

  let payType = isHourly ? "hourly" : "fixed";

  logger.info(
    `Counter offer generated: Rate: $${counterRate}/hr × ${estHours}hrs = $${counterTotal} + Travel: $${travelExpense}`,
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
  };
}

async function isEligibleForApplication(workOrder) {
  logger.info(
    `Checking eligibility - Distance: ${workOrder.distance}mi, Est. Hours: ${workOrder.estLaborHours}`,
    workOrder.platform,
    workOrder.id
  );

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

  // First check if the job is within working hours
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

  // Check eligibility for both FieldNation and WorkMarket
  if (
    workOrder.platform === "FieldNation" ||
    workOrder.platform === "WorkMarket"
  ) {
    // STEP 1: Check payment eligibility FIRST to catch BELOW_MINIMUM auto-rejects
    const paymentCheck = isPaymentEligible(workOrder);
    
    // Auto-reject garbage pay jobs, even if we have free calendar slots
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

    // STEP 2: Fetch existing WorkMarket assignments as busy blocks
    const wmBusyBlocks = await fetchWMAssignments();

    // STEP 3: Check calendar availability (merged with WM busy blocks)
    const calendarResult = await isSlotAvailableCalendar(workOrder, wmBusyBlocks);
    const slotAvailable = calendarResult.isAvailable;

    if (!isInWorkingHours) {
      let bestSlot = calendarResult.counterSlot;

      if (!bestSlot) {
        logger.info(
          `No same-day in-hours slots found, searching upcoming days for outside-hours job...`,
          workOrder.platform,
          workOrder.id
        );
        const nextDay = await findNextAvailableDay(workOrder, 7, wmBusyBlocks);
        bestSlot = nextDay?.bestSlot || null;
      }

      if (bestSlot) {
        logger.info(
          `Outside-hours job will counter with slot ${bestSlot.start.toLocaleTimeString()} - ${bestSlot.end.toLocaleTimeString()}`,
          workOrder.platform,
          workOrder.id
        );
        const counterOffer = calculateCounterOffer(workOrder);
        counterOffer.counterDate = bestSlot;
        return {
          eligible: false,
          counterOffer,
          reason: "COUNTER_DATES",
          busyBlocks: calendarResult.busyBlocks,
        };
      }

      logger.info(
        `Job rejected: Outside working hours and no alternate slots found`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null,
        reason: "OUTSIDE_WORKING_HOURS",
        busyBlocks: calendarResult.busyBlocks,
      };
    }

    if (!slotAvailable) {
      // IS_COUNTER_DATES: instead of rejecting, find free slots and counter-offer with them
      if (CONFIG.IS_COUNTER_DATES && calendarResult.workOrderDate) {
        let bestSlot = calendarResult.counterSlot;

        // If no slots on same day, search upcoming days
        if (!bestSlot) {
          logger.info(
            `No free slots on requested day, searching upcoming days...`,
            workOrder.platform,
            workOrder.id
          );
          const nextDay = await findNextAvailableDay(workOrder, 7, wmBusyBlocks);
          bestSlot = nextDay?.bestSlot || null;
        }

        if (bestSlot) {
          logger.info(
            `IS_COUNTER_DATES enabled - countering with earliest slot: ${bestSlot.start.toLocaleTimeString()} - ${bestSlot.end.toLocaleTimeString()} (${bestSlot.durationMinutes}min for ${workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS}hr job)`,
            workOrder.platform,
            workOrder.id
          );
          const counterOffer = calculateCounterOffer(workOrder);
          counterOffer.counterDate = bestSlot;
          return {
            eligible: false,
            counterOffer: counterOffer,
            reason: "COUNTER_DATES",
            busyBlocks: calendarResult.busyBlocks,
          };
        }
      }

      logger.info(
        `Job rejected: Calendar conflict detected`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null,
        reason: "SLOT_UNAVAILABLE",
        busyBlocks: calendarResult.busyBlocks,
      };
    }

    // STEP 3: Check remaining payment rules ONLY if calendar is available
    if (paymentCheck.isAcceptable) {
      // Both calendar and payment are good - apply directly
      return {
        eligible: true,
        counterOffer: null,
        reason: "ELIGIBLE",
        busyBlocks: calendarResult.busyBlocks,
      };
    } else {
      // Payment or distance check failed 
      if (paymentCheck.issue === "LOW_RATE") {
        if (CONFIG.IS_COUNTER_RATES) {
          logger.info(
            `Job rejected: Rate too low - ${paymentCheck.details}. Generating counter offer.`,
            workOrder.platform,
            workOrder.id
          );
          return {
            eligible: false,
            counterOffer: calculateCounterOffer(workOrder),
            reason: "PAYMENT_INSUFFICIENT", // Triggers counter flow in index.js
            rejectDetails: paymentCheck.details,
          };
        } else {
          logger.info(
            `Job rejected: Rate too low - ${paymentCheck.details}. IS_COUNTER_RATES is false, rejecting without counter.`,
            workOrder.platform,
            workOrder.id
          );
          return {
            eligible: false,
            counterOffer: null,
            reason: "PAYMENT_INSUFFICIENT",
            rejectDetails: paymentCheck.details,
          };
        }
      } else if (paymentCheck.issue === "TRAVEL") {
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
