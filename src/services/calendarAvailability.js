import { CONFIG } from "../../config/config.js";
import schedule from "../../scripts/schedule.js";
import logger from "../utils/logger.js";

// Fallback static availability check
export function isSlotAvailableStatic(workOrder) {
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

  const workDate = orderWindowStart.toISOString().split("T")[0];
  const WORK_START = new Date(
    `${workDate}T${DAY_WORK_START_TIME}:00`
  ).getTime();
  const WORK_END = new Date(`${workDate}T${DAY_WORK_END_TIME}:00`).getTime();

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

  const allEvents = Object.values(schedule).flatMap(week =>
    Object.entries(week).flatMap(([day, events]) => {
      return events.map(event => {
        const eventStart = new Date(event.time.start).getTime();
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

  const sameDayEvents = allEvents.filter(event => {
    const eventDate = new Date(event.start + MIN_BUFFER_MINUTES * 60 * 1000);
    return (
      eventDate.getDate() === orderDate.getDate() &&
      eventDate.getMonth() === orderDate.getMonth() &&
      eventDate.getFullYear() === orderDate.getFullYear()
    );
  });

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

  const sortedEvents = sameDayEvents.sort((a, b) => a.start - b.start);
  const workDurationMs = actualLaborHours * 60 * 60 * 1000;

  if (sortedEvents[0].start > effectiveStart + workDurationMs) {
    logger.info(
      `Time is available: ${actualLaborHours}-hour slot found before first event`,
      workOrder.platform,
      workOrder.id
    );
    return true;
  }

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

// Google Calendar availability check
export async function isSlotAvailableCalendar(workOrder) {
  const MIN_BUFFER_MINUTES = CONFIG.TIME.BUFFER_MINUTES;
  const { start: startTime, end: endTime } = workOrder.time;

  try {
    const { authorize } = await import("./platforms/gmail/login.js");
    const { google } = await import("googleapis");

    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    const workOrderWindowStart = new Date(startTime);
    const workOrderWindowEnd = new Date(endTime);
    const workOrderDate = new Date(
      workOrderWindowStart.getFullYear(),
      workOrderWindowStart.getMonth(),
      workOrderWindowStart.getDate()
    );

    const calendarList = await calendar.calendarList.list();
    const allCalendars = calendarList.data.items || [];

    logger.info(
      `Multi-Calendar Check: Found ${allCalendars.length} calendars to check arrival window`,
      workOrder.platform,
      workOrder.id
    );

    let totalEvents = 0;
    const occupiedSlots = [];

    const timeMin = new Date(workOrderDate).toISOString();
    const timeMax = new Date(
      workOrderDate.getFullYear(),
      workOrderDate.getMonth(),
      workOrderDate.getDate() + 1
    ).toISOString();

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

        for (const event of todayEvents) {
          logger.info(
            `[DEBUG] Event found: "${event.summary}" (${cal.summary})
                - Status: ${event.status}
                - Transparency: ${event.transparency}
                - Start: ${event.start.dateTime || event.start.date}
                - End: ${event.end.dateTime || event.end.date}`,
            workOrder.platform,
            workOrder.id
          );

          if (
            event.status === "cancelled" ||
            event.transparency === "transparent"
          ) {
            continue;
          }

          let eventStart, eventEnd;

          if (event.start.dateTime) {
            eventStart = new Date(event.start.dateTime);
          } else if (event.start.date) {
            eventStart = new Date(event.start.date + "T00:00:00");
          } else {
            continue;
          }

          if (event.end.dateTime) {
            eventEnd = new Date(event.end.dateTime);
          } else if (event.end.date) {
            eventEnd = new Date(event.end.date + "T00:00:00");
          } else {
            continue;
          }

          const bufferedStart = new Date(
            eventStart.getTime() - MIN_BUFFER_MINUTES * 60 * 1000
          );
          const bufferedEnd = new Date(
            eventEnd.getTime() + MIN_BUFFER_MINUTES * 60 * 1000
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

    occupiedSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    const windowStartMs = new Date(startTime).getTime();
    const windowEndMs = new Date(endTime).getTime();
    const windowStartDate = new Date(windowStartMs);
    const windowEndDate = new Date(windowEndMs);

    let availableSlotFound = true;
    const conflictDetails = [];

    for (const occupied of occupiedSlots) {
      if (
        windowStartMs < occupied.end.getTime() &&
        windowEndMs > occupied.start.getTime()
      ) {
        availableSlotFound = false;
        conflictDetails.push({
          testSlot: `${windowStartDate.toLocaleTimeString()} - ${windowEndDate.toLocaleTimeString()}`,
          conflictWith: `${occupied.eventSummary} [${occupied.calendarName}]`,
          conflictTime: `${occupied.start.toLocaleTimeString()} - ${occupied.end.toLocaleTimeString()}`,
        });
        break;
      }
    }

    logger.info(
      `Calendar Availability Check:
      - Work Order Date: ${workOrderDate.toDateString()}
      - Available Window: ${new Date(startTime).toLocaleTimeString()} - ${new Date(
        endTime
      ).toLocaleTimeString()}
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
          .slice(0, 5)
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

    return isSlotAvailableStatic(workOrder);
  }
}
