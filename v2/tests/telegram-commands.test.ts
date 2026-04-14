import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { handleTelegramCommand } from "../src/notifications/telegram/commands.js";
import { openDatabase } from "../src/storage/database.js";
import { NoopCalendarProvider } from "../src/calendar/noopCalendarProvider.js";

test("telegram /start and /stop toggle monitor state", async () => {
  const dbPath = path.resolve("data/test-telegram-1.sqlite");
  try { fs.unlinkSync(dbPath); } catch {}
  const db = openDatabase(dbPath);

  try {
    assert.equal(await handleTelegramCommand(db, new NoopCalendarProvider(), "/start"), "V2 monitor enabled");
    assert.equal(await handleTelegramCommand(db, new NoopCalendarProvider(), "/stop"), "V2 monitor disabled");
  } finally {
    db.close();
  }
});

test("telegram /help returns command summary", async () => {
  const dbPath = path.resolve("data/test-telegram-2.sqlite");
  try { fs.unlinkSync(dbPath); } catch {}
  const db = openDatabase(dbPath);

  try {
    const result = await handleTelegramCommand(db, new NoopCalendarProvider(), "/help");
    assert.match(result, /\/process/);
    assert.match(result, /\/refresh-session/);
  } finally {
    db.close();
  }
});
