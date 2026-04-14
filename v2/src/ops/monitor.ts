import type Database from "better-sqlite3";

import type { CalendarAvailabilityProvider } from "../calendar/provider.js";
import { pollTelegramCommands } from "../notifications/telegram/commands.js";
import { pollGmailSource } from "../sources/gmail/poll.js";
import { processPendingRawEvents } from "../services/processRawEvents.js";
import { getAppState } from "../storage/repositories.js";

export async function runMonitorOnce(
  db: Database.Database,
  calendarProvider: CalendarAvailabilityProvider
): Promise<void> {
  const enabledState = getAppState<{ enabled?: boolean }>(db, "monitor:enabled");
  if (enabledState && enabledState.enabled === false) {
    console.log(JSON.stringify({ polled: 0, processed: 0, commands: 0, enabled: false }, null, 2));
    return;
  }

  const commands = await pollTelegramCommands(db, calendarProvider);
  const events = await pollGmailSource(db);

  for (const event of events) {
    console.log(`[V2] GMAIL EVENT [${event.dedupeKey}] ${event.link}`);
  }

  const processed = await processPendingRawEvents(db, calendarProvider);

  console.log(
    JSON.stringify(
      {
        commands,
        polled: events.length,
        processed
      },
      null,
      2
    )
  );
}

export async function startMonitoringLoop(
  db: Database.Database,
  calendarProvider: CalendarAvailabilityProvider,
  intervalMs: number
): Promise<void> {
  for (;;) {
    try {
      await runMonitorOnce(db, calendarProvider);
    } catch (error) {
      console.error("Monitor loop error", error);
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
