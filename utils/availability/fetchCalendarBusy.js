import { google } from "googleapis";
import { authorize } from "../gmail/login.js";
import logger from "../logger.js";

export async function fetchCalendarBusy(date, daysToCheck) {
  const startDate = new Date(
    date instanceof Date ? date : new Date(date)
  );
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate() + daysToCheck + 1
  );

  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  const auth = await authorize();
  const calendar = google.calendar({ version: "v3", auth });

  const calendarList = await calendar.calendarList.list();
  const allCalendars = calendarList.data.items || [];

  logger.info(
    `fetchCalendarBusy: scanning ${allCalendars.length} calendars from ${startDate.toDateString()} for ${daysToCheck} days`
  );

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

      for (const event of events.data.items || []) {
        const isAllDay = !!event.start.date && !event.start.dateTime;
        if (event.status === "cancelled" || (event.transparency === "transparent" && !isAllDay)) {
          continue;
        }

        let eventStart;
        if (event.start.dateTime) {
          eventStart = new Date(event.start.dateTime);
        } else if (event.start.date) {
          eventStart = new Date(event.start.date + "T00:00:00");
        } else {
          continue;
        }

        let eventEnd;
        if (event.end.dateTime) {
          eventEnd = new Date(event.end.dateTime);
        } else if (event.end.date) {
          eventEnd = new Date(event.end.date + "T00:00:00");
        } else {
          continue;
        }

        busyBlocks.push({
          start: eventStart,
          end: eventEnd,
          summary: event.summary || "Busy",
        });
      }
    } catch (error) {
      logger.info(
        `fetchCalendarBusy: could not check calendar "${cal.summary}": ${error.message}`
      );
    }
  }

  logger.info(
    `fetchCalendarBusy: found ${busyBlocks.length} busy blocks across ${allCalendars.length} calendars`
  );

  return busyBlocks;
}