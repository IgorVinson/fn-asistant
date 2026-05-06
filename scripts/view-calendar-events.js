import { google } from "googleapis";
import { authorize } from "../utils/gmail/login.js";
import { CONFIG } from "../config.js";

// Re-implement findFreeSlots locally since it's not exported from isEligibleForApplication.js
function findFreeSlots(workOrderDate, busyBlocks, minDurationMinutes = 60) {
  const BUFFER = (CONFIG.TIME?.BUFFER_MINUTES ?? 30) * 60 * 1000;
  const workStart = CONFIG.TIME?.WORK_START_TIME ?? "08:00";
  const workEnd = CONFIG.TIME?.WORK_END_TIME ?? "18:00";
  const [wsH, wsM] = workStart.split(":").map(Number);
  const [weH, weM] = workEnd.split(":").map(Number);

  const dayStart = new Date(
    workOrderDate.getFullYear(), workOrderDate.getMonth(), workOrderDate.getDate(), wsH, wsM
  ).getTime();
  const dayEnd = new Date(
    workOrderDate.getFullYear(), workOrderDate.getMonth(), workOrderDate.getDate(), weH, weM
  ).getTime();

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

  const finalGapStart = cursor + BUFFER;
  if (finalGapStart < dayEnd && (dayEnd - finalGapStart) >= minDurationMinutes * 60 * 1000) {
    freeSlots.push({
      start: new Date(finalGapStart),
      end: new Date(dayEnd),
      durationMinutes: Math.round((dayEnd - finalGapStart) / (60 * 1000)),
    });
  }

  return freeSlots;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function formatRawDate(dateStr) {
  if (!dateStr) return "N/A";
  return dateStr;
}

async function main() {
  const args = process.argv.slice(2);
  const daysArg = args.includes("--days") ? parseInt(args[args.indexOf("--days") + 1], 10) : 7;
  const dateArg = args.find(a => a.startsWith("--date="))?.split("=")[1];
  const jsonMode = args.includes("--json");

  console.log("Authenticating with Google...");
  const auth = await authorize();
  const calendar = google.calendar({ version: "v3", auth });

  console.log("Fetching calendar list...");
  const calendarList = await calendar.calendarList.list();
  const allCalendars = calendarList.data.items || [];

  const startDate = dateArg ? new Date(dateArg + "T00:00:00") : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (dateArg ? 1 : daysArg));

  if (jsonMode) {
    console.log(`\nFetching events from ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
  } else {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`  Calendar Events: ${formatDate(startDate)} → ${formatDate(endDate)}`);
    console.log(`  Work Hours: ${CONFIG.TIME?.WORK_START_TIME ?? "08:00"} - ${CONFIG.TIME?.WORK_END_TIME ?? "18:00"}`);
    console.log(`  Buffer: ${CONFIG.TIME?.BUFFER_MINUTES ?? 30} min`);
    console.log(`${"=".repeat(70)}\n`);
  }

  const timeMin = new Date(
    startDate.getFullYear(), startDate.getMonth(), startDate.getDate()
  ).toISOString();
  const timeMax = new Date(
    endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1
  ).toISOString();

  let totalEvents = 0;
  let totalBusyEvents = 0;
  const allBusyBlocksByDate = {};

  for (const cal of allCalendars) {
    try {
      const events = await calendar.events.list({
        calendarId: cal.id,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
      });

      const items = events.data.items || [];
      const busyItems = items.filter(e => e.status !== "cancelled" && e.transparency !== "transparent");

      totalEvents += items.length;
      totalBusyEvents += busyItems.length;

      if (jsonMode) {
        console.log(JSON.stringify({
          calendar: cal.summary,
          calendarId: cal.id,
          events: items.map(e => ({
            summary: e.summary || "No title",
            start: e.start,
            end: e.end,
            status: e.status,
            transparency: e.transparency || "opaque",
            location: e.location || "",
          })),
        }, null, 2));
      } else {
        console.log(`📅 Calendar: "${cal.summary}" (${cal.id})`);
        console.log(`   Events: ${items.length} total, ${busyItems.length} busy\n`);

        if (items.length === 0) {
          console.log("   (no events in range)\n");
        } else {
          let currentDate = null;

          for (const event of items) {
            let eventStart, eventEnd;
            const isAllDay = !event.start.dateTime;

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

            const eventDateKey = eventStart.toISOString().split("T")[0];

            if (!allBusyBlocksByDate[eventDateKey]) {
              allBusyBlocksByDate[eventDateKey] = [];
            }

            if (event.status !== "cancelled" && event.transparency !== "transparent") {
              if (isAllDay) {
                const allDayEnd = new Date(event.end.date);
                allDayEnd.setDate(allDayEnd.getDate() - 1);
                for (let d = new Date(eventStart); d <= allDayEnd; d.setDate(d.getDate() + 1)) {
                  const key = d.toISOString().split("T")[0];
                  if (!allBusyBlocksByDate[key]) allBusyBlocksByDate[key] = [];
                  allBusyBlocksByDate[key].push({
                    start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0),
                    end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59),
                    summary: event.summary || "Busy",
                  });
                }
              } else {
                allBusyBlocksByDate[eventDateKey].push({
                  start: eventStart,
                  end: eventEnd,
                  summary: event.summary || "Busy",
                });
              }
            }

            const eventDateStr = formatDate(eventStart);
            if (eventDateStr !== currentDate) {
              currentDate = eventDateStr;
              console.log(`   ┌─ ${eventDateStr}`);
            }

            const isBusy = event.status !== "cancelled" && event.transparency !== "transparent";
            const timeStr = isAllDay
              ? `ALL DAY (${event.start.date} → ${event.end.date})`
              : `${formatTime(eventStart)} - ${formatTime(eventEnd)}`;

            console.log(`   │ ${timeStr}  ${event.summary || "No title"}`);
            console.log(`   │   Status: ${event.status} | Transparency: ${event.transparency || "opaque"} (${isBusy ? "BUSY" : "FREE"})`);
            console.log(`   │   Raw start: ${JSON.stringify(event.start)}`);
            console.log(`   │   Raw end:   ${JSON.stringify(event.end)}`);
            if (event.location) console.log(`   │   Location: ${event.location}`);
            console.log(`   │`);
          }
          console.log("");
        }
      }
    } catch (error) {
      console.error(`   Error fetching "${cal.summary}": ${error.message}\n`);
    }
  }

  if (!jsonMode) {
    console.log(`${"=".repeat(70)}`);
    console.log(`  SUMMARY`);
    console.log(`${"=".repeat(70)}`);
    console.log(`  Calendars: ${allCalendars.length}`);
    console.log(`  Total events: ${totalEvents}`);
    console.log(`  Busy events: ${totalBusyEvents}`);
    console.log(`  Free/transparent: ${totalEvents - totalBusyEvents}\n`);

    console.log(`${"=".repeat(70)}`);
    console.log(`  FREE SLOTS (as seen by findFreeSlots)`);
    console.log(`  Work Hours: ${CONFIG.TIME?.WORK_START_TIME ?? "08:00"} - ${CONFIG.TIME?.WORK_END_TIME ?? "18:00"}`);
    console.log(`  Buffer: ${CONFIG.TIME?.BUFFER_MINUTES ?? 30} min`);
    console.log(`${"=".repeat(70)}\n`);

    const dates = Object.keys(allBusyBlocksByDate).sort();
    for (const dateKey of dates) {
      const busyBlocks = allBusyBlocksByDate[dateKey];
      const date = new Date(dateKey + "T00:00:00");
      const dayName = formatDate(date);
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;

      if (isWeekend) {
        console.log(`📆 ${dayName} (WEEKEND — skipped)\n`);
        continue;
      }

      console.log(`📆 ${dayName}`);
      console.log(`   Busy blocks: ${busyBlocks.length}`);

      if (busyBlocks.length > 0) {
        for (const block of busyBlocks) {
          console.log(`     - ${formatTime(block.start)} - ${formatTime(block.end)}  "${block.summary}"`);
        }
      }

      const freeSlots = findFreeSlots(date, busyBlocks, 60);
      console.log(`   Free slots (≥60 min): ${freeSlots.length}`);

      if (freeSlots.length === 0) {
        console.log(`     (no free slots ≥60 min)`);
      } else {
        for (const slot of freeSlots) {
          console.log(`     ✓ ${formatTime(slot.start)} - ${formatTime(slot.end)}  (${slot.durationMinutes} min)`);
        }
      }

      console.log("");
    }

    console.log(`${"=".repeat(70)}`);
    console.log("  Done.");
    console.log(`${"=".repeat(70)}`);
  }
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
