import { CONFIG } from "../config.js";
import schedule from "../schedule.js";
import logger from "./logger.js";

// Function to check if time is within working hours
function isWithinWorkingHours(startTime, endTime) {
  const workStartTime = CONFIG.TIME.WORK_START_TIME;
  const workEndTime = CONFIG.TIME.WORK_END_TIME;

  // Format the job start time to Eastern Time string "HH:MM:SS" (24-hour clock)
  // This avoids Node.js UTC offset shifts on AWS/VPS
  const jobStart = new Date(startTime);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    hour: "numeric",
    minute: "numeric",
  });
  const estTimeString = formatter.format(jobStart); // e.g., "11:00"

  // Compare using local hours/minutes directly (no UTC conversion)
  const [workStartH, workStartM] = workStartTime.split(":").map(Number);
  const [workEndH, workEndM] = workEndTime.split(":").map(Number);
  const [jobStartH, jobStartM] = estTimeString.split(":").map(Number);

  const jobStartMinutes = jobStartH * 60 + jobStartM;
  const workStartMinutes = workStartH * 60 + workStartM;
  const workEndMinutes = workEndH * 60 + workEndM;

  // Only check if job starts within working hours
  const isWithinHours =
    jobStartMinutes >= workStartMinutes && jobStartMinutes <= workEndMinutes;

  logger.info(
    `Working Hours Check:
    - Job Date (Local): ${jobStart.toLocaleDateString()}
    - Job Start (ET): ${estTimeString} 
    - Work Hours: ${workStartTime} - ${workEndTime}
    - Within Hours: ${isWithinHours}`,
    "SCHEDULE_CHECK"
  );

  return isWithinHours;
}

function isPaymentEligible(workOrder) {
  const MIN_HOURLY_RATE = CONFIG.RATES.BASE_HOURLY_RATE;
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const platformMinTotal =
    workOrder.platform === "FieldNation"
      ? CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION
      : CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET;
  const minTotalFromHourly = MIN_HOURLY_RATE * estHours;
  const requiredMinTotal = Math.max(minTotalFromHourly, platformMinTotal);
  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;
  const isHourly = workOrder.payType === "hourly" || workOrder.hourlyRate > 0;

  // If distance exceeds threshold, ALWAYS counter (need travel expenses)
  if (workOrder.distance > TRAVEL_THRESHOLD) {
    const details = `Travel required (${workOrder.distance}mi > ${TRAVEL_THRESHOLD}mi)`;
    logger.info(
      `Payment Analysis: ${details} → COUNTER`,
      workOrder.platform,
      workOrder.id
    );
    return { isAcceptable: false, details };
  }

  // Check if pay meets minimum
  if (isHourly) {
    const theirRate = workOrder.hourlyRate || workOrder.payRange.min || 0;
    const offeredTotal = workOrder.payRange.max || theirRate * estHours;
    const isAcceptable =
      theirRate >= MIN_HOURLY_RATE && offeredTotal >= requiredMinTotal;
    
    // Detailed analysis string
    const details = `$${theirRate}/hr (min $${MIN_HOURLY_RATE}), total $${offeredTotal} vs required $${requiredMinTotal}`;
    
    logger.info(
      `Payment Analysis (hourly): ${details} (platform floor: $${platformMinTotal}) → ${isAcceptable ? "ACCEPT" : "COUNTER"}`,
      workOrder.platform,
      workOrder.id
    );
    return { isAcceptable, details };
  } else {
    const offeredTotal = workOrder.payRange.max || 0;
    const isAcceptable = offeredTotal >= requiredMinTotal;
    
    const details = `$${offeredTotal} total vs required $${requiredMinTotal}`;
    
    logger.info(
      `Payment Analysis (fixed): ${details} ($${MIN_HOURLY_RATE}/hr × ${estHours}hrs, platform floor: $${platformMinTotal}) → ${isAcceptable ? "ACCEPT" : "COUNTER"}`,
      workOrder.platform,
      workOrder.id
    );
    return { isAcceptable, details };
  }
}

// New function using Google Calendar for availability checking
async function isSlotAvailableCalendar(workOrder) {
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

    const isAvailable = totalConflicts === 0;

    logger.info(
      `Calendar Availability Check:
      - Work Order Date: ${workOrderDate.toDateString()}
      - Work Order Time: ${workOrderStart.toLocaleTimeString()} - ${workOrderEnd.toLocaleTimeString()}
      - Buffer: ${MIN_BUFFER_MINUTES} minutes
      - Calendars Checked: ${allCalendars.length}
      - Total Events Found: ${totalEvents}
      - Conflicts Found: ${totalConflicts}
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

    return { isAvailable, busyBlocks: allBusyBlocks, workOrderDate };
  } catch (error) {
    logger.error(
      `Error checking calendar availability: ${error.message}. Falling back to static schedule.`,
      workOrder.platform,
      workOrder.id
    );

    // Fallback to static schedule if calendar check fails
    return { isAvailable: isSlotAvailableStatic(workOrder), busyBlocks: [], workOrderDate: null };
  }
}

// Renamed original function as fallback
function isSlotAvailableStatic(workOrder) {
  const DAY_WORK_START_TIME = CONFIG.TIME.WORK_START_TIME;
  const DAY_WORK_END_TIME = CONFIG.TIME.WORK_END_TIME;
  const MIN_BUFFER_MINUTES = CONFIG.TIME.BUFFER_MINUTES;

  const { start: startTime, end: endTime } = workOrder.time;
  const orderStart = new Date(startTime);
  const orderEnd = new Date(endTime);
  const orderDate = new Date(
    orderStart.getFullYear(),
    orderStart.getMonth(),
    orderStart.getDate()
  );

  // Debug logging with better date formatting
  logger.info(
    `Static Schedule Check:
    - Order Date: ${orderDate.toDateString()}
    - Order Time: ${orderStart.toLocaleTimeString()} - ${orderEnd.toLocaleTimeString()}
    - Work Hours: ${DAY_WORK_START_TIME} - ${DAY_WORK_END_TIME}
    - Buffer: ${MIN_BUFFER_MINUTES} minutes`,
    workOrder.platform,
    workOrder.id
  );

  const stampStartTime = orderStart.getTime();
  const stampEndTime = orderEnd.getTime();

  // Create work hours boundaries for the order date using local time
  const [wsH, wsM] = DAY_WORK_START_TIME.split(":").map(Number);
  const [weH, weM] = DAY_WORK_END_TIME.split(":").map(Number);
  const WORK_START = new Date(
    orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), wsH, wsM
  ).getTime();
  const WORK_END = new Date(
    orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), weH, weM
  ).getTime();

  if (stampStartTime < WORK_START || stampEndTime > WORK_END) {
    logger.info(
      `Time is not available: Outside work hours (${DAY_WORK_START_TIME}-${DAY_WORK_END_TIME})`,
      workOrder.platform,
      workOrder.id
    );
    return false;
  }

  // Get all events for comparison
  const allEvents = Object.values(schedule).flatMap(week =>
    Object.entries(week).flatMap(([day, events]) => {
      return events.map(event => ({
        day,
        start: new Date(event.time.start).getTime(),
        end: new Date(event.time.end).getTime(),
      }));
    })
  );

  // Filter events for the same date (year, month, day)
  const sameDayEvents = allEvents.filter(event => {
    const eventDate = new Date(event.start);
    return (
      eventDate.getDate() === orderDate.getDate() &&
      eventDate.getMonth() === orderDate.getMonth() &&
      eventDate.getFullYear() === orderDate.getFullYear()
    );
  });

  // If no events on this day, the slot is available
  if (sameDayEvents.length === 0) {
    logger.info(
      `Time is available: No other events scheduled for ${orderDate.toDateString()}`,
      workOrder.platform,
      workOrder.id
    );
    return true;
  }

  // Sort events by start time
  const sortedEvents = sameDayEvents.sort((a, b) => a.start - b.start);

  let prevEndTime = WORK_START;

  // Check for conflicts with existing events
  for (const event of sortedEvents) {
    if (
      stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
      stampEndTime <= event.start - MIN_BUFFER_MINUTES * 60 * 1000
    ) {
      logger.info(
        `Time is available: Slot found between ${new Date(
          prevEndTime
        ).toLocaleTimeString()} and ${new Date(
          event.start
        ).toLocaleTimeString()}`,
        workOrder.platform,
        workOrder.id
      );
      return true;
    }
    prevEndTime = event.end;
  }

  // Final check for end of day
  const isAvailable =
    stampStartTime >= prevEndTime + MIN_BUFFER_MINUTES * 60 * 1000 &&
    stampEndTime <= WORK_END;

  logger.info(
    `Time ${isAvailable ? "is" : "is not"} available: ${
      isAvailable ? "Slot found at end of day" : "No available slots found"
    }`,
    workOrder.platform,
    workOrder.id
  );

  return isAvailable;
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

// Search upcoming days (up to maxDays) for a free slot via Google Calendar
async function findNextAvailableDay(workOrder, maxDays = 7) {
  const jobDurationMin = (workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS) * 60;
  const [wsH, wsM] = CONFIG.TIME.WORK_START_TIME.split(":").map(Number);
  const [weH, weM] = CONFIG.TIME.WORK_END_TIME.split(":").map(Number);
  const BUFFER = CONFIG.TIME.BUFFER_MINUTES;

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

      const freeSlots = findFreeSlots(checkDate, busyBlocks, jobDurationMin);
      if (freeSlots.length > 0) {
        logger.info(
          `Next available day: ${checkDate.toDateString()} with ${freeSlots.length} slot(s)`,
          workOrder.platform,
          workOrder.id
        );
        return { date: checkDate, freeSlots };
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
  const MIN_HOURLY_RATE = CONFIG.RATES.BASE_HOURLY_RATE; // $50/hr from config
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const platformMinTotal =
    workOrder.platform === "FieldNation"
      ? CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION
      : CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET;
  const minTotalFromHourly = MIN_HOURLY_RATE * estHours;
  const requiredMinTotal = Math.max(minTotalFromHourly, platformMinTotal);

  // Calculate travel expense if over distance threshold
  const travelExpense =
    workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
      ? Math.round(workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE)
      : 0;

  // Determine pay type from order data
  const isHourly = workOrder.payType === "hourly" || workOrder.hourlyRate > 0;

  let counterRate;
  let counterTotal;
  let payType;

  if (isHourly) {
    // Hourly job → counter with hourly rate (max of their rate vs our minimum)
    const theirRate = workOrder.hourlyRate || workOrder.payRange.min || 0;
    const minRateForTotal = Math.ceil(requiredMinTotal / estHours);
    counterRate = Math.max(theirRate, MIN_HOURLY_RATE, minRateForTotal);
    counterTotal = Math.round(counterRate * estHours);
    payType = "hourly";

    logger.info(
      `Counter offer (hourly): Their rate: $${theirRate}/hr, floor rate: $${MIN_HOURLY_RATE}/hr, required total: $${requiredMinTotal} → Counter: $${counterRate}/hr × ${estHours}hrs = $${counterTotal} + Travel: $${travelExpense}`,
      workOrder.platform,
      workOrder.id
    );
  } else {
    // Fixed rate job → counter with fixed amount (max of their amount vs minimum × hours)
    const theirAmount = workOrder.payRange.max || 0;
    counterTotal = Math.max(theirAmount, requiredMinTotal);
    counterRate = Math.round(counterTotal / estHours);
    payType = "fixed";

    logger.info(
      `Counter offer (fixed): Their amount: $${theirAmount}, required total: $${requiredMinTotal} ($${MIN_HOURLY_RATE}/hr × ${estHours}hrs, platform floor: $${platformMinTotal}) → Counter: $${counterTotal} + Travel: $${travelExpense}`,
      workOrder.platform,
      workOrder.id
    );
  }

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

  // First check if the job is within working hours
  const isInWorkingHours = isWithinWorkingHours(
    workOrder.time.start,
    workOrder.time.end
  );

  // If outside working hours, not eligible for direct application or counter-offer
  if (!isInWorkingHours) {
    logger.info(
      `Job rejected: Outside working hours (${CONFIG.TIME.WORK_START_TIME}-${CONFIG.TIME.WORK_END_TIME})`,
      workOrder.platform,
      workOrder.id
    );
    return {
      eligible: false,
      counterOffer: null, // No counter-offer for jobs outside working hours
      reason: "OUTSIDE_WORKING_HOURS",
    };
  }

  // Check if ONLY_GRANITE mode is enabled (applies to all platforms)
  if (
    CONFIG.ONLY_GRANITE &&
    workOrder.company !== "Granite Telecommunications"
  ) {
    logger.info(
      `Job rejected: ONLY_GRANITE mode is enabled and company is ${workOrder.company}`,
      workOrder.platform,
      workOrder.id
    );
    return {
      eligible: false,
      counterOffer: null,
      reason: "ONLY_GRANITE_MODE",
    };
  }

  // Special handling for Granite Telecommunications - skip calendar and payment checks
  if (
    workOrder.platform === "WorkMarket" &&
    workOrder.company === "Granite Telecommunications"
  ) {
    logger.info(
      `Primary company detected (Granite Telecommunications) - skipping calendar and payment checks, only checking distance`,
      workOrder.platform,
      workOrder.id
    );

    // Only check if travel is required
    if (workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES) {
      logger.info(
        `Granite Telecommunications job requires travel (${workOrder.distance} miles > ${CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES} miles) - generating counter offer`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: calculateCounterOffer(workOrder),
        reason: "PAYMENT_INSUFFICIENT", // Changed from GRANITE_TRAVEL_REQUIRED to trigger counter-offer flow
      };
    } else {
      logger.info(
        `Granite Telecommunications job within travel threshold - applying directly`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: true,
        counterOffer: null,
        reason: "GRANITE_ELIGIBLE",
      };
    }
  }

  // Check eligibility for both FieldNation and WorkMarket (non-Granite)
  if (
    workOrder.platform === "FieldNation" ||
    workOrder.platform === "WorkMarket"
  ) {
    // STEP 1: Check calendar availability FIRST
    const calendarResult = await isSlotAvailableCalendar(workOrder);
    const slotAvailable = calendarResult.isAvailable;

    if (!slotAvailable) {
      // IS_COUNTER_DATES: instead of rejecting, find free slots and counter-offer with them
      if (CONFIG.IS_COUNTER_DATES && calendarResult.workOrderDate) {
        let freeSlots = [];
        let counterDate = calendarResult.workOrderDate;

        // Try same day first (if we have busy blocks)
        if (calendarResult.busyBlocks.length > 0) {
          freeSlots = findFreeSlots(calendarResult.workOrderDate, calendarResult.busyBlocks);
        }

        // If no slots on same day, search upcoming days
        if (freeSlots.length === 0) {
          logger.info(
            `No free slots on requested day, searching upcoming days...`,
            workOrder.platform,
            workOrder.id
          );
          const nextDay = await findNextAvailableDay(workOrder);
          if (nextDay) {
            freeSlots = nextDay.freeSlots;
            counterDate = nextDay.date;
          }
        }

        if (freeSlots.length > 0) {
          // Pick the earliest available slot, trimmed to job duration
          const slot = freeSlots[0];
          const jobDurationMs = (workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS) * 60 * 60 * 1000;
          const slotEnd = new Date(Math.min(slot.start.getTime() + jobDurationMs, slot.end.getTime()));
          const bestSlot = {
            start: slot.start,
            end: slotEnd,
            durationMinutes: Math.round((slotEnd - slot.start) / (60 * 1000)),
          };
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
      };
    }

    // STEP 2: Check payment eligibility ONLY if calendar is available
    const paymentCheck = isPaymentEligible(workOrder);
    if (paymentCheck.isAcceptable) {
      // Both calendar and payment are good - apply directly
      return {
        eligible: true,
        counterOffer: null,
        reason: "ELIGIBLE",
      };
    } else {
      // Payment or distance check failed - generate a counter offer
      logger.info(
        `Job rejected: Payment/Distance insufficient - ${paymentCheck.details}. Generating counter offer.`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: calculateCounterOffer(workOrder),
        reason: "PAYMENT_INSUFFICIENT",
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
