import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculateRestartDelay,
  nextCrashCount,
} from "../utils/watchdogPolicy.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const childEntry = path.join(projectRoot, "index.js");

let child = null;
let stopping = false;
let consecutiveCrashes = 0;

async function notifyTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      }
    );
    if (!response.ok) {
      console.error(`Watchdog Telegram alert failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`Watchdog Telegram alert failed: ${error.message}`);
  }
}

function startChild() {
  const startedAt = Date.now();
  child = spawn(process.execPath, [childEntry], {
    cwd: projectRoot,
    env: { ...process.env, FN_ASSISTANT_SUPERVISED: "1" },
    stdio: "inherit",
    windowsHide: true,
  });

  console.log(`🛡️ Watchdog started assistant (PID ${child.pid})`);

  child.once("error", error => {
    console.error(`Watchdog could not start assistant: ${error.message}`);
  });

  child.once("exit", async (code, signal) => {
    const runDurationMs = Date.now() - startedAt;
    child = null;
    if (stopping) return;

    consecutiveCrashes = nextCrashCount(consecutiveCrashes, runDurationMs);
    const delayMs = calculateRestartDelay(consecutiveCrashes);
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    const delaySeconds = Math.round(delayMs / 1000);
    const message = `🔴 FN Assistant stopped unexpectedly (${reason}). Restarting in ${delaySeconds}s.`;

    console.error(message);
    await notifyTelegram(message);
    setTimeout(() => {
      if (!stopping) startChild();
    }, delayMs);
  });
}

function stopWatchdog(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`🛡️ Watchdog stopping (${signal})`);

  if (!child) {
    process.exit(0);
    return;
  }

  child.kill("SIGINT");
  const forceTimer = setTimeout(() => child?.kill(), 10_000);
  forceTimer.unref();
  child.once("exit", () => process.exit(0));
}

process.on("SIGINT", () => stopWatchdog("SIGINT"));
process.on("SIGTERM", () => stopWatchdog("SIGTERM"));

startChild();
