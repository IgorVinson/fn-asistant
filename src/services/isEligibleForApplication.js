import { CONFIG } from "../../config/config.js";
import schedule from "../../scripts/schedule.js";
import logger from "../utils/logger.js";
import { getWMSchedule } from "./platforms/workmarket/getWMSchedule.js";

// Function to check if time window overlaps with working hours
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

  // Check if the time window OVERLAPS with working hours (not contained within)
  const hasOverlap = jobStart < dayWorkEnd && jobEnd > dayWorkStart;

  // Also check if there's enough overlap for DEFAULT_LABOR_HOURS
  const actualLaborHours = CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const overlapStart = new Date(
    Math.max(jobStart.getTime(), dayWorkStart.getTime())
  );
  const overlapEnd = new Date(Math.min(jobEnd.getTime(), dayWorkEnd.getTime()));
  const overlapHours =
    (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60);
  const hasEnoughOverlap = overlapHours >= actualLaborHours;

  logger.info(
    `Working Hours Check:
    - Job Date: ${jobDate}
    - Job Window: ${jobStart.toLocaleTimeString()} - ${jobEnd.toLocaleTimeString()}
    - Work Hours: ${workStartTime} - ${workEndTime}
    - Required Labor Hours: ${actualLaborHours}
    - Overlap Hours: ${overlapHours.toFixed(1)}
    - Has Overlap: ${hasOverlap}
    - Enough Overlap: ${hasEnoughOverlap}
    - Decision: ${hasOverlap && hasEnoughOverlap}`,
    "SCHEDULE_CHECK"
  );

  return hasOverlap && hasEnoughOverlap;
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
  const actualLaborHours = CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const { start: startTime, end: endTime } = workOrder.time;

  try {
    // Use the same simple approach as showAllCalendarsEvents.js
    const { authorize } = await import("./gmail/login.js");
    const { google } = await import("googleapis");

    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    // Get work order time window (when work can start)
    const workOrderWindowStart = new Date(startTime);
    const workOrderWindowEnd = new Date(endTime);

    // Get the work order date in local time zone
    const workOrderDate = new Date(
      workOrderWindowStart.getFullYear(),
      workOrderWindowStart.getMonth(),
      workOrderWindowStart.getDate()
    );

    // Get all calendars
    const calendarList = await calendar.calendarList.list();
    const allCalendars = calendarList.data.items || [];

    logger.info(
      `Multi-Calendar Check: Found ${allCalendars.length} calendars to check for ${actualLaborHours}-hour work block`,
      workOrder.platform,
      workOrder.id
    );

    let totalEvents = 0;
    const occupiedSlots = []; // Track already occupied time slots

    // Get the date range for the work order day (start of day to end of day)
    const timeMin = new Date(workOrderDate).toISOString();
    const timeMax = new Date(
      workOrderDate.getFullYear(),
      workOrderDate.getMonth(),
      workOrderDate.getDate() + 1
    ).toISOString();

    // Collect all occupied time slots from all calendars
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

        // Process each calendar event as an occupied slot
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

          // Calendar events represent available time windows, so we need to create
          // occupied slots assuming work takes DEFAULT_LABOR_HOURS within that window
          // For simplicity, assume work is scheduled at the start of the event window
          const workStart = eventStart;
          const workEnd = new Date(
            workStart.getTime() + actualLaborHours * 60 * 60 * 1000
          );

          // Add buffer time
          const bufferedStart = new Date(
            workStart.getTime() - MIN_BUFFER_MINUTES * 60 * 1000
          );
          const bufferedEnd = new Date(
            workEnd.getTime() + MIN_BUFFER_MINUTES * 60 * 1000
          );

          occupiedSlots.push({
            start: bufferedStart,
            end: bufferedEnd,
            eventSummary: event.summary || "No title",
            calendarName: cal.summary,
          });
        }
      } catch (error) {
        logger.info(
          `Could not check calendar "${cal.summary}": ${error.message}`,
          workOrder.platform,
          workOrder.id
        );
      }
    }

    // Sort occupied slots by start time
    occupiedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    // Check if we can fit a DEFAULT_LABOR_HOURS block within the work order window
    const workDurationMs = actualLaborHours * 60 * 60 * 1000;
    let availableSlotFound = false;
    let conflictDetails = [];

    // Try to find a slot within the work order window
    for (
      let testStart = workOrderWindowStart.getTime();
      testStart + workDurationMs <= workOrderWindowEnd.getTime();
      testStart += 15 * 60 * 1000
    ) {
      // Check every 15 minutes

      const testEnd = testStart + workDurationMs;
      const testStartDate = new Date(testStart);
      const testEndDate = new Date(testEnd);

      // Check if this test slot conflicts with any occupied slot
      let hasConflict = false;
      for (const occupied of occupiedSlots) {
        if (
          testStart < occupied.end.getTime() &&
          testEnd > occupied.start.getTime()
        ) {
          hasConflict = true;
          conflictDetails.push({
            testSlot: `${testStartDate.toLocaleTimeString()} - ${testEndDate.toLocaleTimeString()}`,
            conflictWith: `${occupied.eventSummary} [${occupied.calendarName}]`,
            conflictTime: `${occupied.start.toLocaleTimeString()} - ${occupied.end.toLocaleTimeString()}`,
          });
          break;
        }
      }

      if (!hasConflict) {
        availableSlotFound = true;
        logger.info(
          `Available ${actualLaborHours}-hour slot found: ${testStartDate.toLocaleTimeString()} - ${testEndDate.toLocaleTimeString()}`,
          workOrder.platform,
          workOrder.id
        );
        break;
      }
    }

    logger.info(
      `Calendar Availability Check:
      - Work Order Date: ${workOrderDate.toDateString()}
      - Available Window: ${workOrderWindowStart.toLocaleTimeString()} - ${workOrderWindowEnd.toLocaleTimeString()}
      - Required Duration: ${actualLaborHours} hours
      - Buffer: ${MIN_BUFFER_MINUTES} minutes
      - Calendars Checked: ${allCalendars.length}
      - Total Events Found: ${totalEvents}
      - Occupied Slots: ${occupiedSlots.length}
      - Available Slot Found: ${availableSlotFound}
      - Decision: ${availableSlotFound ? "AVAILABLE" : "CONFLICT"}`,
      workOrder.platform,
      workOrder.id
    );

    if (!availableSlotFound && conflictDetails.length > 0) {
      logger.info(
        `Calendar conflicts details:
        ${conflictDetails
          .slice(0, 5) // Show first 5 conflicts
          .map(
            (conflict, index) =>
              `  ${index + 1}. Test slot ${conflict.testSlot} conflicts with ${
                conflict.conflictWith
              } (${conflict.conflictTime})`
          )
          .join("\n        ")}`,
        workOrder.platform,
        workOrder.id
      );
    }

    return availableSlotFound;
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
  const actualLaborHours = CONFIG.TIME.DEFAULT_LABOR_HOURS;

  const { start: startTime, end: endTime } = workOrder.time;
  const orderWindowStart = new Date(startTime);
  const orderWindowEnd = new Date(endTime);
  const orderDate = new Date(
    orderWindowStart.getFullYear(),
    orderWindowStart.getMonth(),
    orderWindowStart.getDate()
  );

  // Debug logging with better date formatting
  logger.info(
    `Static Schedule Check:
    - Order Date: ${orderDate.toDateString()}
    - Available Window: ${orderWindowStart.toLocaleTimeString()} - ${orderWindowEnd.toLocaleTimeString()}
    - Required Duration: ${actualLaborHours} hours
    - Work Hours: ${DAY_WORK_START_TIME} - ${DAY_WORK_END_TIME}
    - Buffer: ${MIN_BUFFER_MINUTES} minutes`,
    workOrder.platform,
    workOrder.id
  );

  // Create work hours boundaries for the order date
  const workDate = orderWindowStart.toISOString().split("T")[0];
  const WORK_START = new Date(
    `${workDate}T${DAY_WORK_START_TIME}:00`
  ).getTime();
  const WORK_END = new Date(`${workDate}T${DAY_WORK_END_TIME}:00`).getTime();

  // Check if the available window overlaps with work hours
  const windowStart = orderWindowStart.getTime();
  const windowEnd = orderWindowEnd.getTime();

  if (windowStart >= WORK_END || windowEnd <= WORK_START) {
    logger.info(
      `Time window does not overlap with work hours (${DAY_WORK_START_TIME}-${DAY_WORK_END_TIME})`,
      workOrder.platform,
      workOrder.id
    );
    return false;
  }

  // Get effective available window within work hours
  const effectiveStart = Math.max(windowStart, WORK_START);
  const effectiveEnd = Math.min(windowEnd, WORK_END);
  const effectiveWindowHours =
    (effectiveEnd - effectiveStart) / (1000 * 60 * 60);

  if (effectiveWindowHours < actualLaborHours) {
    logger.info(
      `Effective window (${effectiveWindowHours.toFixed(
        1
      )} hours) is shorter than required labor hours (${actualLaborHours} hours)`,
      workOrder.platform,
      workOrder.id
    );
    return false;
  }

  // Get all events for comparison and treat them as occupied blocks
  const allEvents = Object.values(schedule).flatMap(week =>
    Object.entries(week).flatMap(([day, events]) => {
      return events.map(event => {
        const eventStart = new Date(event.time.start).getTime();
        // Treat schedule events as DEFAULT_LABOR_HOURS blocks starting at event time
        const eventEnd = eventStart + actualLaborHours * 60 * 60 * 1000;
        const bufferedStart = eventStart - MIN_BUFFER_MINUTES * 60 * 1000;
        const bufferedEnd = eventEnd + MIN_BUFFER_MINUTES * 60 * 1000;

        return {
          day,
          start: bufferedStart,
          end: bufferedEnd,
        };
      });
    })
  );

  // Filter events for the same date
  const sameDayEvents = allEvents.filter(event => {
    const eventDate = new Date(event.start + MIN_BUFFER_MINUTES * 60 * 1000); // Adjust for buffer to get original event time
    return (
      eventDate.getDate() === orderDate.getDate() &&
      eventDate.getMonth() === orderDate.getMonth() &&
      eventDate.getFullYear() === orderDate.getFullYear()
    );
  });

  // If no events on this day, check if we can fit the work within the effective window
  if (sameDayEvents.length === 0) {
    logger.info(
      `Time is available: No other events scheduled for ${orderDate.toDateString()}, ${effectiveWindowHours.toFixed(
        1
      )} hours available`,
      workOrder.platform,
      workOrder.id
    );
    return true;
  }

  // Sort events by start time
  const sortedEvents = sameDayEvents.sort((a, b) => a.start - b.start);

  // Try to find a slot for the required duration
  const workDurationMs = actualLaborHours * 60 * 60 * 1000;

  // Check before first event
  if (sortedEvents[0].start > effectiveStart + workDurationMs) {
    logger.info(
      `Time is available: ${actualLaborHours}-hour slot found before first event`,
      workOrder.platform,
      workOrder.id
    );
    return true;
  }

  // Check between events
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const gapStart = sortedEvents[i].end;
    const gapEnd = sortedEvents[i + 1].start;

    if (gapEnd - gapStart >= workDurationMs) {
      logger.info(
        `Time is available: ${actualLaborHours}-hour slot found between events ${
          i + 1
        } and ${i + 2}`,
        workOrder.platform,
        workOrder.id
      );
      return true;
    }
  }

  // Check after last event
  const lastEventEnd = sortedEvents[sortedEvents.length - 1].end;
  if (effectiveEnd - lastEventEnd >= workDurationMs) {
    logger.info(
      `Time is available: ${actualLaborHours}-hour slot found after last event`,
      workOrder.platform,
      workOrder.id
    );
    return true;
  }

  logger.info(
    `Time is not available: No ${actualLaborHours}-hour slot found in the available window`,
    workOrder.platform,
    workOrder.id
  );

  return false;
}

async function isSlotAvailableWorkMarket(workOrder) {
  const MIN_BUFFER_MINUTES = CONFIG.TIME.BUFFER_MINUTES;
  const actualLaborHours = CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const { start: startTime, end: endTime } = workOrder.time;

  try {
    // Get occupied slots from WorkMarket
    const occupiedSlots = await getWMSchedule();

    // Get work order time window
    const workOrderStart = new Date(startTime);
    const workOrderEnd = new Date(endTime);
    
    // Sort occupied slots
    occupiedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    logger.info(
      `WorkMarket Schedule Check:
      - Work Order: ${workOrderStart.toLocaleString()} - ${workOrderEnd.toLocaleString()}
      - Found ${occupiedSlots.length} existing assignments`,
      workOrder.platform,
      workOrder.id
    );

    // Check for conflicts
    // We need to find a free block of 'actualLaborHours' within the workOrder window
    // that doesn't overlap with any occupied slot (plus buffer)

    const workDurationMs = actualLaborHours * 60 * 60 * 1000;
    const bufferMs = MIN_BUFFER_MINUTES * 60 * 1000;

    // Iterate through the work order window in 15-minute increments
    for (
      let testStart = workOrderStart.getTime();
      testStart + workDurationMs <= workOrderEnd.getTime();
      testStart += 15 * 60 * 1000
    ) {
      const testEnd = testStart + workDurationMs;
      
      // Check if this test slot conflicts with any occupied slot
      let hasConflict = false;
      for (const slot of occupiedSlots) {
        // Expand occupied slot by buffer
        const slotStartBuffered = slot.start.getTime() - bufferMs;
        const slotEndBuffered = slot.end.getTime() + bufferMs;

        if (testStart < slotEndBuffered && testEnd > slotStartBuffered) {
          hasConflict = true;
          break;
        }
      }

      if (!hasConflict) {
        logger.info(
          `Available slot found in WorkMarket schedule: ${new Date(testStart).toLocaleString()}`,
          workOrder.platform,
          workOrder.id
        );
        return true;
      }
    }

    logger.info(
      `No available slot found in WorkMarket schedule for ${actualLaborHours} hours`,
      workOrder.platform,
      workOrder.id
    );
    return false;

  } catch (error) {
    logger.error(
      `Error checking WorkMarket availability: ${error.message}. Fallback to static check.`,
      workOrder.platform,
      workOrder.id
    );
    return isSlotAvailableStatic(workOrder);
  }
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
    // STEP 1: Check availability based on configuration
    let slotAvailable = false;
    
    if (CONFIG.AVAILABILITY && CONFIG.AVAILABILITY.PROVIDER === "WORKMARKET") {
        slotAvailable = await isSlotAvailableWorkMarket(workOrder);
    } else {
        // Default to Google Calendar
        slotAvailable = await isSlotAvailableCalendar(workOrder);
    }

    if (!slotAvailable) {
      logger.info(
        `Job rejected: Schedule conflict detected (${CONFIG.AVAILABILITY ? CONFIG.AVAILABILITY.PROVIDER : "GOOGLE_CALENDAR"})`,
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
