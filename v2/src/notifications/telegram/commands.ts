import type Database from "better-sqlite3";

import type { CalendarAvailabilityProvider } from "../../calendar/provider.js";
import { importLiveFieldNationJob } from "../../app/importLiveFieldNationJob.js";
import { importLiveWorkMarketJob } from "../../app/importLiveWorkMarketJob.js";
import { listSessions, listRecentJobs, setAppState } from "../../storage/repositories.js";
import { formatTelegramJobAlert, sendTelegramMessage } from "./notifier.js";
import { refreshSession } from "../../app/refreshSession.js";

function statusSummary(db: Database.Database): string {
  const sessions = listSessions(db)
    .map(session => `${session.platform}: ${session.status}`)
    .join("\n");
  const jobs = listRecentJobs(db, 5)
    .map(job => `${job.job_id} ${job.decision_type ?? "no-decision"} ${job.reason_code ?? ""}`.trim())
    .join("\n");

  return `V2 STATUS\nSessions:\n${sessions || "none"}\nRecent Jobs:\n${jobs || "none"}`;
}

export async function handleTelegramCommand(
  db: Database.Database,
  calendarProvider: CalendarAvailabilityProvider,
  text: string
): Promise<string> {
  const [command, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(" ").trim();

  if (command === "/start") {
    setAppState(db, "monitor:enabled", { enabled: true });
    return "V2 monitor enabled";
  }

  if (command === "/stop") {
    setAppState(db, "monitor:enabled", { enabled: false });
    return "V2 monitor disabled";
  }

  if (command === "/status") {
    return statusSummary(db);
  }

  if (command === "/refresh-session") {
    const target = arg === "wm" || arg === "fn" || arg === "all" ? arg : "all";
    await refreshSession(db, target);
    return `V2 session refresh completed: ${target}`;
  }

  if (command === "/process") {
    if (!arg) {
      return "Usage: /process <workmarket-url|fieldnation-url|wm:id|fn:id>";
    }

    const normalizedArg =
      arg.startsWith("wm:") || arg.startsWith("fn:") ? arg.slice(3) : arg;

    const result =
      /fieldnation/i.test(arg) || arg.startsWith("fn:")
        ? await importLiveFieldNationJob(db, calendarProvider, normalizedArg)
        : await importLiveWorkMarketJob(db, calendarProvider, normalizedArg);

    return formatTelegramJobAlert(result);
  }

  if (command === "/help") {
    return "Commands: /start /stop /status /process <id|url> /refresh-session <wm|fn|all>";
  }

  return "Unknown V2 command. Use /help";
}

export async function pollTelegramCommands(
  db: Database.Database,
  calendarProvider: CalendarAvailabilityProvider
): Promise<number> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return 0;
  }

  const state = await import("../../storage/repositories.js").then(module =>
    module.getAppState<{ updateId?: number }>(db, "telegram:update-offset")
  );

  const params = new URLSearchParams({
    timeout: "1"
  });
  if (state?.updateId) {
    params.set("offset", String(state.updateId + 1));
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?${params.toString()}`);
  const payload = (await response.json()) as {
    ok: boolean;
    result?: Array<{
      update_id: number;
      message?: {
        chat?: { id?: number };
        text?: string;
      };
    }>;
  };

  let handled = 0;

  for (const update of payload.result ?? []) {
    await import("../../storage/repositories.js").then(module =>
      module.setAppState(db, "telegram:update-offset", { updateId: update.update_id })
    );

    if (String(update.message?.chat?.id ?? "") !== chatId) {
      continue;
    }

    const text = update.message?.text?.trim();
    if (!text?.startsWith("/")) {
      continue;
    }

    const reply = await handleTelegramCommand(db, calendarProvider, text);
    await sendTelegramMessage(reply);
    handled += 1;
  }

  return handled;
}
