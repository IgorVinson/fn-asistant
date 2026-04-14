import type Database from "better-sqlite3";

import type { CalendarAvailabilityProvider } from "../calendar/provider.js";
import { importLiveFieldNationJob } from "../app/importLiveFieldNationJob.js";
import { importLiveWorkMarketJob } from "../app/importLiveWorkMarketJob.js";
import { formatTelegramJobAlert, sendTelegramMessage } from "../notifications/telegram/notifier.js";
import { listPendingRawEvents, updateRawEventStatus } from "../storage/repositories.js";

function classifyImportError(message: string): "failed" | "skipped" {
  if (/Could not extract WorkMarket order ID from redirect URL/i.test(message)) {
    return "skipped";
  }
  if (/FieldNation order unavailable/i.test(message)) {
    return "skipped";
  }
  if (/Executable doesn't exist|playwright install/i.test(message)) {
    return "skipped";
  }
  return "failed";
}

export async function processPendingRawEvents(
  db: Database.Database,
  calendarProvider: CalendarAvailabilityProvider,
  limit = 25
): Promise<number> {
  const pending = listPendingRawEvents(db, limit);
  let processed = 0;

  for (const event of pending) {
    console.log(`[V2] PROCESSING [${event.dedupe_key}] ${event.link ?? "no-link"}`);

    try {
      if (!event.link) {
        throw new Error("Raw event did not contain a job link");
      }

      const result = event.link.includes("workmarket")
        ? await importLiveWorkMarketJob(db, calendarProvider, event.link)
        : await importLiveFieldNationJob(db, calendarProvider, event.link);

      await sendTelegramMessage(
        formatTelegramJobAlert({
          normalized: result.normalized,
          decision: result.decision
        })
      );

      console.log(
        `[V2] DECISION [${event.dedupe_key}] ${result.decision.type.toUpperCase()} ${result.decision.reason}`
      );

      updateRawEventStatus(db, {
        id: event.id,
        status: "processed"
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = classifyImportError(message);
      updateRawEventStatus(db, {
        id: event.id,
        status
      });

      if (status === "skipped") {
        console.log(`[V2] SKIPPED [${event.dedupe_key}] ${message}`);
      }

      if (status === "failed") {
        console.error(`[V2] FAILED [${event.dedupe_key}] ${message}`);
        await sendTelegramMessage(`V2 FAILED [${event.dedupe_key}]\n${message}`);
      }
    }
  }

  return processed;
}
