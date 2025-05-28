import { google } from "googleapis";
import logger from "../logger.js";
import { authorize } from "./login.js";

// Cache for storing calendar events to reduce API calls
let calendarCache = {
  events: [],
  lastFetched: null,
  cacheValidMinutes: 15, // Cache events for 15 minutes
};

/**
 * Get Google Calendar events for a specific date range
 * @param {string} calendarId - Calendar ID (default: 'primary' for main calendar)
 * @param {string} timeMin - Start time in ISO format
 * @param {string} timeMax - End time in ISO format
 * @returns {Promise<Array>} Array of calendar events
 */
export async function getCalendarEvents(
  calendarId = "primary",
  timeMin = null,
  timeMax = null
) {
  try {
    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    // If no time range specified, get events for today
    if (!timeMin) {
      const today = new Date();
      timeMin = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).toISOString();
    }

    if (!timeMax) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      timeMax = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate()
      ).toISOString();
    }

    logger.info(
      `Fetching calendar events from ${timeMin} to ${timeMax} for calendar: ${calendarId}`
    );

    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: timeMin,
      timeMax: timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });

    const events = response.data.items || [];

    logger.info(`Found ${events.length} calendar events`);

    return events.map(event => ({
      id: event.id,
      summary: event.summary || "No title",
      description: event.description || "",
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      status: event.status,
      attendees: event.attendees || [],
      location: event.location || "",
      creator: event.creator,
      organizer: event.organizer,
      transparency: event.transparency || "opaque", // 'opaque' means busy, 'transparent' means free
      originalEvent: event, // Keep full event data for reference
    }));
  } catch (error) {
    logger.error(`Error fetching calendar events: ${error.message}`);
    throw error;
  }
}

/**
 * Get calendar events for a specific date with caching
 * @param {Date} date - The date to check
 * @param {string} calendarId - Calendar ID
 * @returns {Promise<Array>} Array of events for the specified date
 */
export async function getEventsForDate(date, calendarId = "primary") {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD format

  // Check cache first
  if (isCacheValid(dateStr)) {
    logger.info(`Using cached calendar events for ${dateStr}`);
    return calendarCache.events.filter(event => {
      const eventDate = new Date(event.start).toISOString().split("T")[0];
      return eventDate === dateStr;
    });
  }

  // Fetch events for the entire day
  const timeMin = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).toISOString();
  const timeMax = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1
  ).toISOString();

  const events = await getCalendarEvents(calendarId, timeMin, timeMax);

  // Update cache
  updateCache(events, dateStr);

  return events;
}

/**
 * Get calendar events for a date range (useful for checking multiple days)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} calendarId - Calendar ID
 * @returns {Promise<Array>} Array of events in the date range
 */
export async function getEventsForDateRange(
  startDate,
  endDate,
  calendarId = "primary"
) {
  const timeMin = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  ).toISOString();
  const timeMax = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate() + 1
  ).toISOString();

  return await getCalendarEvents(calendarId, timeMin, timeMax);
}

/**
 * Check if there's a time conflict with existing calendar events
 * @param {string} startTime - Start time in ISO format
 * @param {string} endTime - End time in ISO format
 * @param {number} bufferMinutes - Buffer time in minutes to add before/after
 * @param {string} calendarId - Calendar ID
 * @returns {Promise<Object>} Object with conflict status and details
 */
export async function checkTimeConflict(
  startTime,
  endTime,
  bufferMinutes = 30,
  calendarId = "primary"
) {
  try {
    const workOrderStart = new Date(startTime);
    const workOrderEnd = new Date(endTime);
    const workOrderDate = new Date(
      workOrderStart.getFullYear(),
      workOrderStart.getMonth(),
      workOrderStart.getDate()
    );

    // Get events for the day
    const events = await getEventsForDate(workOrderDate, calendarId);

    logger.info(
      `Checking time conflict for ${startTime} - ${endTime} with ${bufferMinutes}min buffer against ${events.length} calendar events`
    );

    // Filter out transparent (free) events and cancelled events
    const busyEvents = events.filter(
      event =>
        event.status !== "cancelled" && event.transparency !== "transparent"
    );

    const conflicts = [];

    for (const event of busyEvents) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      // Add buffer time
      const bufferedWorkStart = new Date(
        workOrderStart.getTime() - bufferMinutes * 60 * 1000
      );
      const bufferedWorkEnd = new Date(
        workOrderEnd.getTime() + bufferMinutes * 60 * 1000
      );

      // Check for overlap
      if (bufferedWorkStart < eventEnd && bufferedWorkEnd > eventStart) {
        conflicts.push({
          eventId: event.id,
          eventSummary: event.summary,
          eventStart: event.start,
          eventEnd: event.end,
          overlapType: getOverlapType(
            workOrderStart,
            workOrderEnd,
            eventStart,
            eventEnd
          ),
        });
      }
    }

    const hasConflict = conflicts.length > 0;

    logger.info(
      `Time conflict check result: ${
        hasConflict ? "CONFLICT" : "NO CONFLICT"
      } - Found ${conflicts.length} conflicting events`
    );

    return {
      hasConflict,
      conflicts,
      totalEvents: events.length,
      busyEvents: busyEvents.length,
      checkedTimeRange: { startTime, endTime, bufferMinutes },
    };
  } catch (error) {
    logger.error(`Error checking time conflict: ${error.message}`);
    throw error;
  }
}

/**
 * Get user's primary calendar information
 * @returns {Promise<Object>} Calendar information
 */
export async function getCalendarInfo(calendarId = "primary") {
  try {
    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.calendars.get({
      calendarId: calendarId,
    });

    return {
      id: response.data.id,
      summary: response.data.summary,
      description: response.data.description,
      timeZone: response.data.timeZone,
      primary: response.data.primary || false,
    };
  } catch (error) {
    logger.error(`Error getting calendar info: ${error.message}`);
    throw error;
  }
}

/**
 * Clear the calendar cache (useful for testing or forcing refresh)
 */
export function clearCalendarCache() {
  calendarCache = {
    events: [],
    lastFetched: null,
    cacheValidMinutes: 15,
  };
  logger.info("Calendar cache cleared");
}

/**
 * Get all accessible calendars in the current account
 * @returns {Promise<Array>} Array of calendar objects
 */
export async function getAllCalendars() {
  try {
    const auth = await authorize();
    const calendar = google.calendar({ version: "v3", auth });

    const calendarList = await calendar.calendarList.list();

    logger.info(`Found ${calendarList.data.items.length} calendars in account`);

    return calendarList.data.items || [];
  } catch (error) {
    logger.error(`Error fetching calendar list: ${error.message}`);
    throw error;
  }
}

/**
 * Check for time conflicts across ALL calendars in the account
 * @param {string} startTime - Start time in ISO format
 * @param {string} endTime - End time in ISO format
 * @param {number} bufferMinutes - Buffer time in minutes to add before/after
 * @param {Array<string>} excludeCalendars - Optional array of calendar IDs to exclude from checking
 * @returns {Promise<Object>} Object with conflict status and details across all calendars
 */
export async function checkTimeConflictAllCalendars(
  startTime,
  endTime,
  bufferMinutes = 30,
  excludeCalendars = []
) {
  try {
    const workOrderStart = new Date(startTime);
    const workOrderEnd = new Date(endTime);
    const workOrderDate = new Date(
      workOrderStart.getFullYear(),
      workOrderStart.getMonth(),
      workOrderStart.getDate()
    );

    logger.info(
      `Checking time conflict across all calendars for ${startTime} - ${endTime} with ${bufferMinutes}min buffer`
    );

    // Get all calendars
    const allCalendars = await getAllCalendars();
    const calendarsToCheck = allCalendars.filter(
      cal => !excludeCalendars.includes(cal.id)
    );

    logger.info(
      `Checking ${calendarsToCheck.length} calendars (excluded ${excludeCalendars.length})`
    );

    let totalEvents = 0;
    let totalBusyEvents = 0;
    const allConflicts = [];
    const calendarResults = [];

    // Check each calendar for conflicts
    for (const cal of calendarsToCheck) {
      try {
        logger.info(`Checking calendar: "${cal.summary}" (${cal.id})`);

        // Get events for this calendar
        const events = await getEventsForDate(workOrderDate, cal.id);

        // Filter out transparent (free) events and cancelled events
        const busyEvents = events.filter(
          event =>
            event.status !== "cancelled" && event.transparency !== "transparent"
        );

        const calendarConflicts = [];

        for (const event of busyEvents) {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);

          // Add buffer time
          const bufferedWorkStart = new Date(
            workOrderStart.getTime() - bufferMinutes * 60 * 1000
          );
          const bufferedWorkEnd = new Date(
            workOrderEnd.getTime() + bufferMinutes * 60 * 1000
          );

          // Check for overlap
          if (bufferedWorkStart < eventEnd && bufferedWorkEnd > eventStart) {
            const conflict = {
              eventId: event.id,
              eventSummary: event.summary,
              eventStart: event.start,
              eventEnd: event.end,
              calendarName: cal.summary,
              calendarId: cal.id,
              overlapType: getOverlapType(
                workOrderStart,
                workOrderEnd,
                eventStart,
                eventEnd
              ),
            };

            calendarConflicts.push(conflict);
            allConflicts.push(conflict);
          }
        }

        // Store results for this calendar
        calendarResults.push({
          calendarId: cal.id,
          calendarName: cal.summary,
          totalEvents: events.length,
          busyEvents: busyEvents.length,
          conflicts: calendarConflicts.length,
          hasConflict: calendarConflicts.length > 0,
        });

        totalEvents += events.length;
        totalBusyEvents += busyEvents.length;

        logger.info(
          `Calendar "${cal.summary}": ${events.length} events, ${busyEvents.length} busy, ${calendarConflicts.length} conflicts`
        );
      } catch (error) {
        logger.error(
          `Error checking calendar "${cal.summary}": ${error.message}`
        );
        // Continue with other calendars even if one fails
        calendarResults.push({
          calendarId: cal.id,
          calendarName: cal.summary,
          error: error.message,
          hasConflict: false, // Assume no conflict if we can't check
        });
      }
    }

    const hasConflict = allConflicts.length > 0;

    logger.info(
      `Multi-calendar conflict check result: ${
        hasConflict ? "CONFLICT" : "NO CONFLICT"
      } - Found ${allConflicts.length} conflicts across ${
        calendarsToCheck.length
      } calendars`
    );

    return {
      hasConflict,
      conflicts: allConflicts,
      totalEvents,
      busyEvents: totalBusyEvents,
      calendarsChecked: calendarsToCheck.length,
      calendarResults,
      checkedTimeRange: { startTime, endTime, bufferMinutes },
    };
  } catch (error) {
    logger.error(
      `Error checking time conflict across all calendars: ${error.message}`
    );
    throw error;
  }
}

function getOverlapType(workStart, workEnd, eventStart, eventEnd) {
  if (workStart >= eventStart && workEnd <= eventEnd) {
    return "WORK_INSIDE_EVENT";
  } else if (eventStart >= workStart && eventEnd <= workEnd) {
    return "EVENT_INSIDE_WORK";
  } else if (workStart < eventEnd && workEnd > eventEnd) {
    return "WORK_OVERLAPS_END";
  } else if (workStart < eventStart && workEnd > eventStart) {
    return "WORK_OVERLAPS_START";
  }
  return "PARTIAL_OVERLAP";
}

// Export default object with all functions
export default {
  getCalendarEvents,
  getEventsForDate,
  getEventsForDateRange,
  checkTimeConflict,
  getCalendarInfo,
  clearCalendarCache,
  getAllCalendars,
  checkTimeConflictAllCalendars,
};
