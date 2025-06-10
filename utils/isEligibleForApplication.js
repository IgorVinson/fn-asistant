import { CONFIG } from "../config.js";
import schedule from "../schedule.js";
import logger from "./logger.js";

// Function to check if time is within working hours
function isWithinWorkingHours(startTime, endTime) {
  const workStartTime = CONFIG.TIME.WORK_START_TIME;
  const workEndTime = CONFIG.TIME.WORK_END_TIME;

  // Parse the job times properly
  const jobStart = new Date(startTime);
  const jobEnd = new Date(endTime);

  // Get the date in YYYY-MM-DD format for consistent time zone handling
  const jobDate = jobStart.toISOString().split("T")[0];

  // Create work start/end times for the job date
  const dayWorkStart = new Date(`${jobDate}T${workStartTime}:00`);
  const dayWorkEnd = new Date(`${jobDate}T${workEndTime}:00`);

  // Check if job times fall within working hours
  const isWithinHours = jobStart >= dayWorkStart && jobEnd <= dayWorkEnd;

  logger.info(
    `Working Hours Check:
    - Job Date: ${jobDate}
    - Job Time: ${jobStart.toLocaleTimeString()} - ${jobEnd.toLocaleTimeString()}
    - Work Hours: ${workStartTime} - ${workEndTime}
    - Within Hours: ${isWithinHours}`,
    "SCHEDULE_CHECK"
  );

  return isWithinHours;
}

function isPaymentEligible(workOrder) {
  // If no labor hours specified, use default from config
  let estLaborHours =
    workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;

  // Get platform-specific minimum pay threshold
  const MIN_PAY_THRESHOLD =
    workOrder.platform === "WorkMarket"
      ? CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET
      : CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION;

  // Calculate travel expense for FULL distance if it exceeds threshold
  const travelExpense =
    workOrder.distance > TRAVEL_THRESHOLD
      ? workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE
      : 0;

  let decisionReason = "";

  // If distance exceeds threshold, ALWAYS require travel expenses
  if (workOrder.distance > TRAVEL_THRESHOLD) {
    // Never accept directly if travel is required - always counter offer
    decisionReason = `Travel required: Distance ${
      workOrder.distance
    } miles > ${TRAVEL_THRESHOLD} miles threshold. Base pay $${
      workOrder.payRange.max
    } + travel $${travelExpense.toFixed(2)} needed`;

    logger.info(
      `Payment Analysis:
      - Platform: ${workOrder.platform}
      - Offered Pay: $${workOrder.payRange.max}
      - Minimum Threshold: $${MIN_PAY_THRESHOLD}
      - Distance: ${workOrder.distance} miles
      - Travel Threshold: ${TRAVEL_THRESHOLD} miles
      - Travel Expense: $${travelExpense.toFixed(2)}
      - Required Pay: $${workOrder.payRange.max} + $${travelExpense.toFixed(
        2
      )} (travel)
      - Decision: REJECT (Counter offer needed for travel)
      - Reason: ${decisionReason}`,
      workOrder.platform,
      workOrder.id
    );

    return false; // Always reject to trigger counter offer
  }

  // For jobs within travel threshold, check if base pay meets minimum
  if (workOrder.payRange.max < MIN_PAY_THRESHOLD) {
    decisionReason = `Base pay too low ($${workOrder.payRange.max} < $${MIN_PAY_THRESHOLD}) and distance (${workOrder.distance} miles) is within free travel limit (${TRAVEL_THRESHOLD} miles)`;
  } else {
    decisionReason = `Base pay acceptable: $${workOrder.payRange.max} >= $${MIN_PAY_THRESHOLD} and no travel required`;
  }

  // Log the decision
  logger.info(
    `Payment Analysis:
    - Platform: ${workOrder.platform}
    - Offered Pay: $${workOrder.payRange.max}
    - Minimum Threshold: $${MIN_PAY_THRESHOLD}
    - Distance: ${workOrder.distance} miles
    - Travel Threshold: ${TRAVEL_THRESHOLD} miles
    - Travel Expense: $${travelExpense.toFixed(2)}
    - Required Pay: $${MIN_PAY_THRESHOLD}
    - Decision: ${
      workOrder.payRange.max >= MIN_PAY_THRESHOLD ? "ACCEPT" : "REJECT"
    }
    - Reason: ${decisionReason}`,
    workOrder.platform,
    workOrder.id
  );

  return workOrder.payRange.max >= MIN_PAY_THRESHOLD;
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

    return isAvailable;
  } catch (error) {
    logger.error(
      `Error checking calendar availability: ${error.message}. Falling back to static schedule.`,
      workOrder.platform,
      workOrder.id
    );

    // Fallback to static schedule if calendar check fails
    return isSlotAvailableStatic(workOrder);
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

  // Create work hours boundaries for the order date
  const workDate = orderStart.toISOString().split("T")[0];
  const WORK_START = new Date(
    `${workDate}T${DAY_WORK_START_TIME}:00`
  ).getTime();
  const WORK_END = new Date(`${workDate}T${DAY_WORK_END_TIME}:00`).getTime();

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

function calculateCounterOffer(workOrder) {
  const BASE_HOURS = 2;
  const ADDITIONAL_HOURLY_RATE = 55;

  // Get platform-specific minimum pay threshold
  const MIN_PAY_THRESHOLD =
    workOrder.platform === "WorkMarket"
      ? CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET
      : CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION;

  // Calculate travel expense for FULL distance if it exceeds threshold
  const travelExpense =
    workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
      ? Math.round(workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE)
      : 0;

  const isFixedRate = workOrder.estLaborHours <= 2;

  const additionalHours = isFixedRate
    ? 0
    : Math.max(1, workOrder.estLaborHours - BASE_HOURS);

  // If payment is acceptable but travel is needed, use their offered amount
  // If payment is too low, use minimum threshold
  let baseAmount;
  if (
    workOrder.payRange.max >= MIN_PAY_THRESHOLD &&
    workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
  ) {
    // Use their offered amount since it's acceptable, just add travel
    baseAmount = workOrder.payRange.max;
  } else {
    // Use minimum threshold for low payments
    baseAmount = MIN_PAY_THRESHOLD;
  }

  logger.info(
    `Counter offer calculation: Base: $${baseAmount} (${
      baseAmount === workOrder.payRange.max
        ? "offered amount"
        : "minimum threshold"
    }) + Travel: $${travelExpense} = Total: $${baseAmount + travelExpense}`,
    workOrder.platform,
    workOrder.id
  );

  return {
    shouldCounterOffer: true,
    payType: isFixedRate ? "fixed" : "blended",
    baseHours: isFixedRate ? 0 : BASE_HOURS,
    baseAmount: baseAmount,
    additionalHours: additionalHours,
    additionalAmount: isFixedRate ? 0 : ADDITIONAL_HOURLY_RATE,
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
        reason: "GRANITE_TRAVEL_REQUIRED",
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
    const slotAvailable = await isSlotAvailableCalendar(workOrder);

    if (!slotAvailable) {
      logger.info(
        `Job rejected: Calendar conflict detected`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: null, // No counter-offer if calendar has conflicts
        reason: "SLOT_UNAVAILABLE",
      };
    }

    // STEP 2: Check payment eligibility ONLY if calendar is available
    if (isPaymentEligible(workOrder)) {
      // Both calendar and payment are good - apply directly
      return {
        eligible: true,
        counterOffer: null,
        reason: "ELIGIBLE",
      };
    } else {
      // Calendar is available but payment is insufficient - generate counter offer
      logger.info(
        `Calendar available but payment insufficient - generating counter offer`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false, // Changed from true to false
        counterOffer: calculateCounterOffer(workOrder),
        reason: "PAYMENT_INSUFFICIENT",
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
