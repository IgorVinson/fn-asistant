import { CONFIG } from "../config.js";
import schedule from "../schedule.js";
import logger from "./logger.js";

// Function to check if time is within working hours
function isWithinWorkingHours(startTime, endTime) {
  const workStartTime = CONFIG.TIME.WORK_START_TIME;
  const workEndTime = CONFIG.TIME.WORK_END_TIME;

  const jobDate = startTime.split("T")[0];

  const jobStartTime = new Date(startTime).getTime();
  const jobEndTime = new Date(endTime).getTime();

  const dayWorkStart = new Date(`${jobDate}T${workStartTime}:00`).getTime();
  const dayWorkEnd = new Date(`${jobDate}T${workEndTime}:00`).getTime();

  return jobStartTime >= dayWorkStart && jobEndTime <= dayWorkEnd;
}

function isPaymentEligible(workOrder) {
  // If no labor hours specified, use default from config
  let estLaborHours =
    workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;

  // Calculate required pay
  let requiredPay = CONFIG.RATES.MIN_PAY_THRESHOLD; // Minimum acceptable pay
  let decisionReason = "";

  // Check if minimum pay meets our requirements
  if (workOrder.payRange.max < CONFIG.RATES.MIN_PAY_THRESHOLD) {
    // Only consider counter-offer if distance exceeds threshold
    if (workOrder.distance > TRAVEL_THRESHOLD) {
      const travelExpense =
        (workOrder.distance - TRAVEL_THRESHOLD) *
        CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE;
      decisionReason = `Base pay too low ($${workOrder.payRange.max} < $${
        CONFIG.RATES.MIN_PAY_THRESHOLD
      }), adding travel expenses: ${
        workOrder.distance - TRAVEL_THRESHOLD
      } miles × $${
        CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE
      }/mile = $${travelExpense}`;
    } else {
      decisionReason = `Base pay too low ($${workOrder.payRange.max} < $${CONFIG.RATES.MIN_PAY_THRESHOLD}) and distance (${workOrder.distance} miles) is within free travel limit (${TRAVEL_THRESHOLD} miles)`;
    }
  } else {
    decisionReason = `Base pay acceptable: $${workOrder.payRange.max} >= $${CONFIG.RATES.MIN_PAY_THRESHOLD}`;
  }

  // Log the decision
  logger.info(
    `Payment Analysis:
    - Offered Pay: $${workOrder.payRange.max}
    - Minimum Threshold: $${CONFIG.RATES.MIN_PAY_THRESHOLD}
    - Distance: ${workOrder.distance} miles
    - Travel Threshold: ${TRAVEL_THRESHOLD} miles
    - Required Pay: $${requiredPay}
    - Decision: ${workOrder.payRange.max >= requiredPay ? "ACCEPT" : "REJECT"}
    - Reason: ${decisionReason}`,
    workOrder.platform,
    workOrder.id
  );

  return workOrder.payRange.max >= requiredPay;
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

    // Get work order time details
    const workOrderStart = new Date(startTime);
    const workOrderEnd = new Date(endTime);
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

    // Get today's date range
    const timeMin = new Date(
      workOrderDate.getFullYear(),
      workOrderDate.getMonth(),
      workOrderDate.getDate()
    ).toISOString();
    const timeMax = new Date(
      workOrderDate.getFullYear(),
      workOrderDate.getMonth(),
      workOrderDate.getDate() + 1
    ).toISOString();

    // Check each calendar for conflicts (same as showAllCalendarsEvents.js)
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

          const eventStart = new Date(event.start.dateTime || event.start.date);
          const eventEnd = new Date(event.end.dateTime || event.end.date);

          // Add buffer time
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
              eventStart: eventStart.toLocaleTimeString(),
              eventEnd: eventEnd.toLocaleTimeString(),
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
      `Simple Multi-Calendar Check:
      - Time: ${workOrderStart.toLocaleTimeString()} - ${workOrderEnd.toLocaleTimeString()}
      - Buffer: ${MIN_BUFFER_MINUTES} minutes
      - Calendars Checked: ${allCalendars.length}
      - Total Events: ${totalEvents}
      - Conflicts Found: ${totalConflicts}
      - Decision: ${isAvailable ? "AVAILABLE" : "CONFLICT"}`,
      workOrder.platform,
      workOrder.id
    );

    if (!isAvailable && conflicts.length > 0) {
      logger.info(
        `Calendar conflicts:
        ${conflicts
          .map(
            (conflict, index) =>
              `  ${index + 1}. "${conflict.eventSummary}" [${
                conflict.calendarName
              }] (${conflict.eventStart} - ${conflict.eventEnd})`
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
  const orderDate = new Date(startTime);
  const orderDay = orderDate.getDate();
  const orderMonth = orderDate.getMonth() + 1;

  // Debug logging
  logger.info(
    `Schedule Check:
    - Date: ${orderMonth}/${orderDay}
    - Time: ${startTime} - ${endTime}
    - Work Hours: ${DAY_WORK_START_TIME} - ${DAY_WORK_END_TIME}
    - Buffer: ${MIN_BUFFER_MINUTES} minutes`,
    workOrder.platform,
    workOrder.id
  );

  const stampStartTime = new Date(startTime).getTime();
  const stampEndTime = new Date(endTime).getTime();

  const WORK_START = new Date(
    `${startTime.split("T")[0]}T${DAY_WORK_START_TIME}:00`
  ).getTime();
  const WORK_END = new Date(
    `${startTime.split("T")[0]}T${DAY_WORK_END_TIME}:00`
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

  // Filter events for the same day AND month
  const sameDayEvents = allEvents.filter(event => {
    const eventDate = new Date(event.start);
    return (
      eventDate.getDate() === orderDay &&
      eventDate.getMonth() === orderDate.getMonth()
    );
  });

  // If no events on this day, the slot is available
  if (sameDayEvents.length === 0) {
    logger.info(
      `Time is available: No other events scheduled for this day`,
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
  const BASE_RATE = 150;
  const ADDITIONAL_HOURLY_RATE = 55;
  const TRAVEL_THRESHOLD = 30;

  const travelExpense =
    workOrder.distance > TRAVEL_THRESHOLD ? Math.round(workOrder.distance) : 0;

  const isFixedRate = workOrder.estLaborHours <= 2;

  const additionalHours = isFixedRate
    ? 0
    : Math.max(1, workOrder.estLaborHours - BASE_HOURS);

  return {
    shouldCounterOffer: true,
    payType: isFixedRate ? "fixed" : "blended",
    baseHours: isFixedRate ? 0 : BASE_HOURS,
    baseAmount: BASE_RATE,
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

  // Check eligibility for both FieldNation and WorkMarket
  if (
    workOrder.platform === "FieldNation" ||
    workOrder.platform === "WorkMarket"
  ) {
    if (isPaymentEligible(workOrder)) {
      const slotAvailable = await isSlotAvailableCalendar(workOrder);
      return {
        eligible: slotAvailable,
        counterOffer: null,
        reason: slotAvailable ? "ELIGIBLE" : "SLOT_UNAVAILABLE",
      };
    } else {
      // If payment is not good, generate counter offer
      return {
        eligible: false,
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
