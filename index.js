import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "fs/promises";
import fsSync from "fs";
import { google } from "googleapis";
import path from "path";
import puppeteer from "puppeteer";
import { CONFIG } from "./config.js";
import { getFNorderData } from "./utils/FieldNation/getFNorderData.js";
import { loginFnAuto } from "./utils/FieldNation/loginFnAuto.js";
import { postFNCounterOffer } from "./utils/FieldNation/postFNCounterOffer.js";
import { postFNworkOrderRequest } from "./utils/FieldNation/postFNworkOrderRequest.js";
import { sendWorkOrderMessage } from "./utils/FieldNation/sendWorkOrderMessage.js";
import { getLastUnreadEmail } from "./utils/gmail/getLastUnreadEmail.js";
import { getOrderLink } from "./utils/gmail/getOrderLink.js";
import { authorize } from "./utils/gmail/login.js";
import isEligibleForApplication from "./utils/isEligibleForApplication.js";
import { isTransientNetworkError } from "./utils/isTransientNetworkError.js";
import logger from "./utils/logger.js";
import normalizeDateFromWO from "./utils/normalizedDateFromWO.js";
import playSound from "./utils/playSound.js";
import { saveReplay } from "./utils/saveReplay.js";
import { getAvailableBlocks } from "./utils/availability/getAvailableBlocks.js";
import { getWorkOrderLocalDate } from "./utils/isEligibleForApplication.js";
import telegramBot from "./utils/telegram/telegramBot.js";
import { getWMorderData } from "./utils/WorkMarket/getWMorderData.js";
import { loginWMAuto } from "./utils/WorkMarket/loginWMAuto.js";
import { probeWMSession } from "./utils/WorkMarket/wmSession.js";
import { postWMCounterOffer } from "./utils/WorkMarket/postWMCounterOffer.js";
import { postWMworkOrderRequest } from "./utils/WorkMarket/postWMworkOrderRequest.js";

// Configure the server
const app = express();
app.use(cors());
app.use(express.json());
const port = 3001;

// --- Global State for Dashboard ---
let eventHistory = [];
const logsFilePath = path.join(process.cwd(), "logs", "logs.json");

// Function to write events to logs.json file
const writeEventsToFile = async events => {
  try {
    await fs.writeFile(logsFilePath, JSON.stringify(events, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing to logs.json:", error);
  }
};

// Function to push event to both memory and logs.json
const pushEvent = async event => {
  const newEvent = {
    ...event,
    id: event.id || Math.random().toString(36).substr(2, 9),
    time: new Date().toLocaleTimeString(),
  };

  // Add to memory
  eventHistory.unshift(newEvent);
  if (eventHistory.length > 50) eventHistory.pop();

  // Write to logs.json
  await writeEventsToFile(eventHistory);
};

// --- API Endpoints ---

// Get current system status and config
app.get("/api/status", (req, res) => {
  res.json({
    isMonitoring: telegramBot.isMonitoring,
    config: CONFIG,
  });
});

// Get event history (reads from logs.json file)
app.get("/api/events", async (req, res) => {
  try {
    // Read from logs.json file
    const events = await fs.readFile(logsFilePath, "utf8");
    res.json(JSON.parse(events));
  } catch (error) {
    console.error("Error reading logs.json:", error);
    res.json(eventHistory); // Fallback to memory if file read fails
  }
});

// Update config
app.post("/api/config", (req, res) => {
  const newConfig = req.body;

  if (newConfig.RATES) Object.assign(CONFIG.RATES, newConfig.RATES);
  if (newConfig.TIME) Object.assign(CONFIG.TIME, newConfig.TIME);
  if (newConfig.DISTANCE) Object.assign(CONFIG.DISTANCE, newConfig.DISTANCE);

  if (newConfig.FIELDNATION_ENABLED !== undefined)
    CONFIG.FIELDNATION_ENABLED = newConfig.FIELDNATION_ENABLED;
  if (newConfig.WORKMARKET_ENABLED !== undefined)
    CONFIG.WORKMARKET_ENABLED = newConfig.WORKMARKET_ENABLED;
  if (newConfig.TEST_MODE !== undefined) CONFIG.TEST_MODE = newConfig.TEST_MODE;

  console.log("⚙️ Configuration updated via UI:", CONFIG);
  res.json({ success: true, config: CONFIG });
});

// Webhook endpoint for Macrodroid phone alerts
app.post("/api/phone-alert", async (req, res) => {
  console.log("\n📱 Received phone alert webhook:", req.body);

  const { text } = req.body;

  if (!text || !text.startsWith("FN_ALERT")) {
    console.log("❌ Invalid alert format:", text?.substring(0, 100));
    return res
      .status(400)
      .json({ error: "Invalid alert format. Must start with FN_ALERT" });
  }

  const alert = {
    raw: text,
    type: "FN_ALERT",
  };

  // Parse key=value pairs
  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(1)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      alert[key] = value;
    }
  }

  console.log("✅ Valid FN_ALERT received via webhook, processing...");
  await handlePhoneAlert(alert);

  res.json({ success: true, message: "Alert processed" });
});

// Start/Stop Agent
app.post("/api/monitor/:action", async (req, res) => {
  const { action } = req.params;

  if (action === "start") {
    startMonitoring();
    res.json({ success: true, isMonitoring: true });
  } else if (action === "stop") {
    stopMonitoring();
    res.json({ success: true, isMonitoring: false });
  } else {
    res.status(400).json({ error: "Invalid action" });
  }
});

let browser; // Declare a browser instance
let reloginTimeout; // Timeout for the relogin scheduler
let monitoringInterval; // Store the monitoring interval
let monitoringStartPromise = null; // Single-flight guard while Gmail auth starts
let isRefreshingCookies = false; // Flag to prevent concurrent cookie refresh attempts
let cookieRefreshPromise = null; // Shared single-flight refresh for every trigger
const phoneAlertDedup = new Map();
const inFlightOrders = new Map();
const recentlyProcessedOrders = new Map();
const ORDER_DEDUP_TTL_MS = 5 * 60 * 1000;

// --- WorkMarket session health -------------------------------------------
// Correct session detection makes authExpired fire far more often than the old
// (broken) string match did, so a re-login cooldown keeps a genuinely broken
// login from turning into a 2FA storm.
let sessionProbeTimeout; // Timeout for the WM session probe
let lastReloginAt = 0; // Timestamp of the last cookie refresh attempt
let consecutiveWmSessionFailures = 0; // Drives the Telegram alert
const RELOGIN_COOLDOWN_MS = 5 * 60 * 1000;
const WM_FAILURE_ALERT_THRESHOLD = 3;

// Orders dropped because the session was dead. getLastUnreadEmail marks the
// email read BEFORE the order is processed, so without this queue a dropped
// order is gone for good.
const wmRetryQueue = [];
// Attempt counts live outside the queue so they survive a drain: an order that
// fails again is re-queued as a fresh entry, and without this it would retry
// forever.
const wmRetryAttempts = new Map();
const RETRY_MAX_ATTEMPTS = 2;
const RETRY_TTL_MS = 30 * 60 * 1000;
let isDrainingRetryQueue = false; // Reentrancy guard: draining calls processOrder
let pendingRetryDrain = false; // Set when a refresh inside processOrder succeeds

function canRelogin() {
  return Date.now() - lastReloginAt >= RELOGIN_COOLDOWN_MS;
}

function reloginCooldownRemainingMs() {
  return Math.max(0, RELOGIN_COOLDOWN_MS - (Date.now() - lastReloginAt));
}

// Append a dropped order to logs/unprocessed-orders.ndjson for post-mortem.
function recordUnprocessedOrder(orderLink, reason, workOrderId = "unknown") {
  try {
    const logDir = path.join(process.cwd(), "logs");
    fsSync.mkdirSync(logDir, { recursive: true });
    fsSync.appendFileSync(
      path.join(logDir, "unprocessed-orders.ndjson"),
      `${JSON.stringify({
        orderLink,
        workOrderId,
        reason,
        ts: new Date().toISOString(),
      })}\n`
    );
  } catch (error) {
    logger.error(
      `Failed to record unprocessed order: ${error.message}`,
      "WorkMarket"
    );
  }
}

function queueOrderForRetry(orderLink, workOrderId = "unknown", reason = "") {
  if (!orderLink) return;

  const existing = wmRetryQueue.find(item => item.orderLink === orderLink);
  if (existing) {
    existing.ts = Date.now();
    return;
  }

  wmRetryQueue.push({ orderLink, workOrderId, ts: Date.now(), attempts: 0 });
  recordUnprocessedOrder(orderLink, reason, workOrderId);
  logger.warn(
    `Order queued for retry after session recovery (${reason})`,
    "WorkMarket",
    workOrderId
  );
}

// Re-process orders that were dropped while the session was dead. Called after
// any successful cookie refresh (scheduled rotation or probe-triggered).
async function drainWmRetryQueue() {
  pendingRetryDrain = false;
  // drainWmRetryQueue -> processOrder -> (session failure) -> queueOrderForRetry
  // is a live cycle; the guard keeps it from re-entering itself.
  if (isDrainingRetryQueue || wmRetryQueue.length === 0) return;
  isDrainingRetryQueue = true;

  const now = Date.now();
  // Drop stale entries — a hours-old work order is not worth applying to.
  for (let i = wmRetryQueue.length - 1; i >= 0; i--) {
    if (now - wmRetryQueue[i].ts > RETRY_TTL_MS) {
      const [stale] = wmRetryQueue.splice(i, 1);
      wmRetryAttempts.delete(stale.orderLink);
      logger.info(
        `Dropping expired retry entry (older than ${RETRY_TTL_MS / 60000} min)`,
        "WorkMarket",
        stale.workOrderId
      );
    }
  }

  try {
    const batch = wmRetryQueue.splice(0, wmRetryQueue.length);
    if (batch.length === 0) return;

    logger.info(
      `Retrying ${batch.length} order(s) after session recovery`,
      "WorkMarket"
    );
    pushEvent({
      platform: "WorkMarket",
      status: "info",
      message: `Retrying ${batch.length} order(s) after re-login`,
    });

    for (const item of batch) {
      const attempts = (wmRetryAttempts.get(item.orderLink) || 0) + 1;
      wmRetryAttempts.set(item.orderLink, attempts);

      if (attempts > RETRY_MAX_ATTEMPTS) {
        logger.warn(
          `Giving up on order after ${RETRY_MAX_ATTEMPTS} retry attempts`,
          "WorkMarket",
          item.workOrderId
        );
        wmRetryAttempts.delete(item.orderLink);
        continue;
      }

      try {
        const result = await processOrder(item.orderLink);
        // processOrder re-queues itself if the session is still dead, so a
        // clean return means this entry is finished with.
        if (result !== null) wmRetryAttempts.delete(item.orderLink);
      } catch (error) {
        logger.error(
          `Retry failed: ${error.message}`,
          "WorkMarket",
          item.workOrderId
        );
      }
    }
  } finally {
    isDrainingRetryQueue = false;
  }
}

function buildPhoneAlertKey(alert) {
  return [
    alert?.source || "unknown",
    alert?.title || "",
    alert?.text || "",
    alert?.action || "",
  ].join("|");
}

function isDuplicatePhoneAlert(alert) {
  const key = buildPhoneAlertKey(alert);
  const now = Date.now();
  const ttlMs = 5 * 60 * 1000;

  for (const [storedKey, expiresAt] of phoneAlertDedup.entries()) {
    if (expiresAt <= now) {
      phoneAlertDedup.delete(storedKey);
    }
  }

  const existingExpiry = phoneAlertDedup.get(key);
  if (existingExpiry && existingExpiry > now) {
    return true;
  }

  phoneAlertDedup.set(key, now + ttlMs);
  return false;
}

function buildOrderProcessingKey(orderLink) {
  const platform = determinePlatform(orderLink);
  const idMatch = orderLink.match(
    platform === "FieldNation"
      ? /\/workorders\/(\d+)/i
      : /\/assignments\/(?:details\/)?(\d+)/i
  );

  if (idMatch) return `${platform}:${idMatch[1]}`;

  try {
    const url = new URL(orderLink);
    const path = url.pathname.replace(/\/$/, "");
    // WorkMarket email links are SendGrid redirects. Their pathname is always
    // /uni/ls/click, while the query string contains the unique destination.
    const query = url.hostname === "sendgrid.workmarket.com" ? url.search : "";
    return `${platform}:${url.origin}${path}${query}`;
  } catch {
    return `${platform}:${orderLink}`;
  }
}

function pruneRecentlyProcessedOrders(now = Date.now()) {
  for (const [key, expiresAt] of recentlyProcessedOrders.entries()) {
    if (expiresAt <= now) recentlyProcessedOrders.delete(key);
  }
}

function extractFieldNationOrderLinkFromAlert(alert) {
  const candidates = [
    alert?.link,
    alert?.url,
    alert?.text,
    alert?.title,
    alert?.raw,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const directLink = extractOrderLink(candidate);
    if (directLink) {
      return directLink;
    }
  }

  for (const candidate of candidates) {
    const workOrderMatch = candidate.match(/\bWO\s*#?\s*(\d{6,})\b/i);
    if (workOrderMatch) {
      return `https://app.fieldnation.com/workorders/${workOrderMatch[1]}`;
    }
  }

  return null;
}

async function handlePhoneAlert(alert) {
  if (!alert || alert.type !== "FN_ALERT") {
    return;
  }

  if (isDuplicatePhoneAlert(alert)) {
    console.log("⏭️ Duplicate phone alert skipped");
    await pushEvent({
      platform: "FieldNation",
      status: "info",
      message: "Duplicate phone alert skipped",
      title: alert.title || "Phone Alert",
      source: "phone_telegram",
    });
    return;
  }

  const orderLink = extractFieldNationOrderLinkFromAlert(alert);

  await pushEvent({
    platform: "FieldNation",
    status: orderLink ? "info" : "warning",
    message: orderLink
      ? "Phone alert received: extracted FieldNation link"
      : "Phone alert received: no FieldNation link found",
    title: alert.title || "Phone Alert",
    source: "phone_telegram",
  });

  if (orderLink) {
    console.log("📱 Processing FieldNation order from phone alert:", orderLink);
    await processOrder(orderLink);
  }
}

// Cleanup function to kill all Chrome processes spawned by puppeteer
async function cleanupChromeProcesses() {
  try {
    console.log("🧹 Cleaning up Chrome processes...");
    const { execSync } = await import("child_process");
    try {
      // Kill Chrome for Testing processes (Puppeteer's own browser).
      // Do NOT match "Google Chrome Helper" here — those are the interactive
      // Chrome app's renderer/GPU processes and killing them crashes the
      // user's open tabs instead of Puppeteer's instance.
      execSync('pkill -9 -f "Google Chrome for Testing" 2>/dev/null');
    } catch (e) {
      // Ignore errors if no processes found
    }
    console.log("✅ Chrome cleanup complete");
  } catch (error) {
    console.error("❌ Error during Chrome cleanup:", error.message);
  }
}

// Graceful shutdown handlers
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Stop monitoring
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  if (reloginTimeout) {
    clearTimeout(reloginTimeout);
    reloginTimeout = null;
  }

  // Close browser
  if (browser) {
    try {
      await browser.close();
      console.log("✅ Browser closed");
    } catch (err) {
      console.error("Error closing browser:", err.message);
    }
    browser = null;
  }

  // Cleanup zombie Chrome processes
  await cleanupChromeProcesses();

  console.log("👋 Goodbye!");
  process.exit(0);
}

// Backstop: keep the agent alive on stray async rejections instead of crashing.
process.on("unhandledRejection", reason => {
  const detail =
    reason instanceof Error ? reason.stack || reason.message : String(reason);
  console.error("⚠️ Unhandled promise rejection (process kept alive):", detail);
  try {
    logger.error("Unhandled promise rejection", reason);
  } catch {
    // logger unavailable — console output above is enough
  }
});

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("exit", async () => {
  // Final cleanup on exit
  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
});

// Function to schedule a relogin with a 4-hour interval (strict)
function scheduleRelogin() {
  // Clear any existing timeout
  if (reloginTimeout) {
    clearTimeout(reloginTimeout);
  }

  // Strict interval: 4 hours in milliseconds (no variance)
  const baseInterval = 4 * 60 * 60 * 1000;

  // Calculate the next relogin time (no random variance)
  const nextReloginTime = baseInterval;

  // Schedule the next relogin
  reloginTimeout = setTimeout(async () => {
    console.log("⏰ Scheduled relogin triggered...");
    logger.info("Scheduled relogin triggered", "WorkMarket");
    try {
      await refreshCookies("scheduled rotation");
      consecutiveWmSessionFailures = 0;
      // Any orders dropped while the session was dead get another chance now.
      await drainWmRetryQueue();
    } catch (error) {
      logger.error(`Scheduled relogin failed: ${error.message}`, "WorkMarket");
    } finally {
      // Schedule the next relogin even when this attempt failed.
      scheduleRelogin();
    }
  }, nextReloginTime);

  // Log the next relogin time
  const nextReloginHours = Math.floor(nextReloginTime / (60 * 60 * 1000));
  const nextReloginMinutes = Math.floor(
    (nextReloginTime % (60 * 60 * 1000)) / (60 * 1000)
  );
  console.log(
    `🔄 Next relogin scheduled in ${nextReloginHours} hours and ${nextReloginMinutes} minutes`
  );
}

// Periodically confirm the WorkMarket session is still alive. scheduleRelogin()
// only rotates every 4 hours but the WM session dies in ~1-2 hours, so without
// this probe the agent spends hours logged out, silently dropping every order
// that arrives in the gap. The probe notices the expiry BETWEEN orders.
function scheduleSessionProbe() {
  if (sessionProbeTimeout) {
    clearTimeout(sessionProbeTimeout);
    sessionProbeTimeout = undefined;
  }

  const minutes = Number(CONFIG.WM_SESSION_PROBE_MINUTES) || 0;
  if (minutes <= 0 || !CONFIG.WORKMARKET_ENABLED) {
    logger.info("WorkMarket session probe disabled", "WorkMarket");
    return;
  }

  sessionProbeTimeout = setTimeout(async () => {
    try {
      // Don't probe on top of an in-flight refresh — it would just read
      // half-written cookies and force a redundant login.
      if (!isRefreshingCookies) {
        const result = await probeWMSession();

        if (result.ok) {
          consecutiveWmSessionFailures = 0;
          logger.debug("WorkMarket session probe: alive", "WorkMarket");
        } else if (!canRelogin()) {
          logger.warn(
            `WorkMarket session probe failed (${result.reason}) but re-login is on cooldown for ${Math.ceil(reloginCooldownRemainingMs() / 1000)}s`,
            "WorkMarket"
          );
        } else {
          logger.warn(
            `WorkMarket session probe failed (${result.reason}) — refreshing cookies`,
            "WorkMarket"
          );
          pushEvent({
            platform: "WorkMarket",
            status: "info",
            message: "Session probe failed — re-logging in",
          });

          await refreshCookies("WorkMarket session probe");

          const verify = await probeWMSession();
          if (verify.ok) {
            consecutiveWmSessionFailures = 0;
            logger.info(
              "WorkMarket session restored by probe-triggered re-login",
              "WorkMarket"
            );
            await drainWmRetryQueue();
          } else {
            noteWmSessionFailure(`probe re-login did not restore session (${verify.reason})`);
          }
        }
      }
    } catch (error) {
      logger.error(`WorkMarket session probe errored: ${error.message}`, "WorkMarket");
    } finally {
      scheduleSessionProbe();
    }
  }, minutes * 60 * 1000);

  logger.info(`WorkMarket session probe scheduled every ${minutes} min`, "WorkMarket");
}

// Escalate to Telegram once WM session trouble stops looking like a blip.
function noteWmSessionFailure(reason) {
  consecutiveWmSessionFailures += 1;
  logger.error(
    `WorkMarket session failure #${consecutiveWmSessionFailures}: ${reason}`,
    "WorkMarket"
  );

  if (consecutiveWmSessionFailures === WM_FAILURE_ALERT_THRESHOLD) {
    telegramBot.sendMessage(
      `🔴 WorkMarket session is broken — ${consecutiveWmSessionFailures} consecutive failures.\nLast reason: ${reason}\nOrders are being queued for retry. Try /relogin.`
    );
  }
}

const SAVE_COOKIES_TIMEOUT_MS = 4 * 60 * 1000;

// Initialize Puppeteer and log in to FieldNation and WorkMarket.
// Wrapped in a hard timeout so a hung Puppeteer/Gmail step can never wedge
// callers (notably the cookie-refresh path that holds isRefreshingCookies).
async function saveCookies() {
  let timeoutHandle;
  try {
    await Promise.race([
      saveCookiesImpl(),
      new Promise((_, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              new Error(
                `saveCookies timed out after ${SAVE_COOKIES_TIMEOUT_MS}ms`
              )
            ),
          SAVE_COOKIES_TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    console.error("❌ saveCookies failed:", error.message);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
      browser = null;
    }
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function saveCookiesImpl() {
  try {
    console.log("🚀 Starting automated login process...");

    // Cleanup any zombie Chrome processes before starting
    await cleanupChromeProcesses();

    // Close the existing browser instance if it exists
    if (browser) {
      try {
        await browser.close();
        console.log("🔒 Closed existing browser instance");
      } catch (err) {
        console.error("Error closing browser:", err);
      }
      browser = null;
    }

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--enable-experimental-web-platform-features", // Enable shadow DOM support
        "--force-device-scale-factor=1",
        "--disable-extensions-except",
        "--disable-plugins-discovery",
        "--enable-blink-features=ShadowDOMV0", // Additional shadow DOM support
        "--force-device-scale-factor=1",
        "--disable-extensions-except",
        "--disable-plugins-discovery",
        "--incognito", // Enable incognito mode
      ],
    });

    // Get Gmail auth for potential 2FA code retrieval
    const gmailAuth = await authorize();

    const loginFailures = [];

    // Login to FieldNation with the new automated system
    if (CONFIG.FIELDNATION_ENABLED) {
      console.log("🔑 Logging into FieldNation...");
      const fnResult = await loginFnAuto(
        browser,
        undefined,
        undefined,
        null,
        false,
        gmailAuth
      );
      if (fnResult.success) {
        console.log("✅ FieldNation login successful");
      } else {
        console.error("❌ FieldNation login failed:", fnResult.error);
        loginFailures.push(`FieldNation: ${fnResult.error}`);
      }
    } else {
      console.log("⏭️ FieldNation login skipped (disabled)");
    }

    // Login to WorkMarket with the new automated system
    if (CONFIG.WORKMARKET_ENABLED) {
      console.log("🔑 Logging into WorkMarket...");
      const wmResult = await loginWMAuto(
        browser,
        undefined,
        undefined,
        null,
        false,
        gmailAuth
      );
      if (wmResult.success) {
        console.log("✅ WorkMarket login successful");
      } else {
        console.error("❌ WorkMarket login failed:", wmResult.error);
        loginFailures.push(`WorkMarket: ${wmResult.error}`);
      }
    } else {
      console.log("⏭️ WorkMarket login skipped (disabled)");
    }

    if (loginFailures.length > 0) {
      throw new Error(`Cookie refresh failed (${loginFailures.join("; ")})`);
    }

    console.log("🍪 Login process completed, cookies validated and saved");
  } catch (error) {
    console.error("❌ Error during automated login process:", error);
    throw error;
  }
}

// All refresh sources share one promise. This prevents scheduled, manual,
// probe-triggered, and order-triggered logins from closing each other's browser
// or racing to replace the same cookie files.
function refreshCookies(reason = "unspecified") {
  if (cookieRefreshPromise) {
    logger.info(`Cookie refresh already running; joined by ${reason}`);
    return cookieRefreshPromise;
  }

  isRefreshingCookies = true;
  lastReloginAt = Date.now();
  cookieRefreshPromise = saveCookies().finally(() => {
    isRefreshingCookies = false;
    cookieRefreshPromise = null;
  });
  return cookieRefreshPromise;
}

// Periodically check for unread emails
async function periodicCheck() {
  let auth;
  try {
    auth = await authorize();
  } catch (error) {
    logger.error("Gmail authorization failed; monitoring not started", error);
    console.error(
      "❌ Gmail authorization failed; monitoring not started:",
      error.message
    );
    telegramBot.sendMessage(
      `❌ Gmail auth failed — monitoring not started.\n${error.message}`
    );
    telegramBot.isMonitoring = false;
    return;
  }
  const gmail = google.gmail({ version: "v1", auth });

  // Initial announcement sound
  console.log("Starting to monitor for new job orders...");
  telegramBot.sendMessage("🚀 Job monitoring started!");
  playSound("notification");

  let isCheckingEmail = false;

  // Backoff state for transient network outages (e.g. VPN/DNS stalls causing
  // the Gmail OAuth token refresh to ETIMEDOUT). During an outage we skip
  // cycles until `networkRetryAt`, log once on entry and once on recovery,
  // instead of spamming a stack trace + Telegram message every second.
  const NETWORK_BACKOFF_BASE_MS = 5000; // first retry after 5s
  const NETWORK_BACKOFF_MAX_MS = 60000; // cap backoff at 60s
  let networkOutage = false;
  let networkRetryAt = 0;
  let networkRetryDelay = NETWORK_BACKOFF_BASE_MS;

  monitoringInterval = setInterval(async () => {
    if (!telegramBot.isMonitoring) {
      return; // Skip if monitoring is disabled via Telegram
    }

    // Do not proceed with email check if cookies are being refreshed
    if (isRefreshingCookies) {
      return;
    }

    // During a network outage, hold off until the backoff window elapses.
    if (networkOutage && Date.now() < networkRetryAt) {
      return;
    }

    // Do not overlap email processing requests
    if (isCheckingEmail) {
      return;
    }

    isCheckingEmail = true;

    try {
      const lastEmailBody = await getLastUnreadEmail(auth, gmail);

      // Recovered from a prior network outage — reset backoff and announce once.
      if (networkOutage) {
        console.log("✅ Network recovered — resuming email monitoring.");
        telegramBot.sendMessage("✅ Network recovered — monitoring resumed.");
        networkOutage = false;
        networkRetryDelay = NETWORK_BACKOFF_BASE_MS;
      }

      if (lastEmailBody) {
        logger.debug("Email body received.");
        const orderLink = extractOrderLink(lastEmailBody);
        if (orderLink) {
          logger.debug(`Order link extracted: ${orderLink}`);
          await processOrder(orderLink);

          // If processOrder recovered the session mid-flight, replay anything
          // that was dropped while it was dead. Done here, outside
          // processOrder, to keep the drain from re-entering it.
          if (pendingRetryDrain) await drainWmRetryQueue();

          // Add a delay to ensure sounds can finish playing
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.log("No valid order link found in email.");
        }
      } else {
        console.log("No unread emails found.");
      }
    } catch (error) {
      if (isTransientNetworkError(error)) {
        // Transient connectivity loss: back off with exponential delay and log
        // only on the first failure of the outage, not once per cycle.
        if (!networkOutage) {
          networkOutage = true;
          logger.error("Transient network error during email check", error);
          console.warn(
            `⚠️ Network error during email check (${error.code || error.message}); backing off and retrying.`
          );
          telegramBot.sendMessage(
            "⚠️ Network issue — pausing monitoring, will retry automatically."
          );
        }
        networkRetryAt = Date.now() + networkRetryDelay;
        networkRetryDelay = Math.min(
          networkRetryDelay * 2,
          NETWORK_BACKOFF_MAX_MS
        );
      } else {
        // Non-transient error: surface as before.
        console.error("Error during email check:", error);
        telegramBot.sendMessage(`❌ Error during monitoring: ${error.message}`);
      }
    } finally {
      isCheckingEmail = false;
    }
  }, 1000); // Check every sec
}

function startMonitoring() {
  telegramBot.isMonitoring = true;

  if (monitoringInterval || monitoringStartPromise) return;

  monitoringStartPromise = periodicCheck()
    .catch(error => {
      logger.error("periodicCheck failed to start", error);
      console.error("❌ periodicCheck failed to start:", error.message);
    })
    .finally(() => {
      monitoringStartPromise = null;
    });
}

function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  telegramBot.isMonitoring = false;
  telegramBot.sendMessage("⏹️ Job monitoring stopped!");
}

// Extract order link from email
function extractOrderLink(emailBody) {
  try {
    return getOrderLink(emailBody);
  } catch (error) {
    console.error("Error extracting order link:", error);
    return null;
  }
}

function determinePlatform(orderLink) {
  if (orderLink.includes("fieldnation")) {
    return "FieldNation";
  } else if (orderLink.includes("workmarket")) {
    return "WorkMarket";
  }
  return null;
}

// Apply for the job
async function applyForJob(orderLink, startDateAndTime, estLaborHours, id) {
  const platform = determinePlatform(orderLink);

  if (CONFIG.TEST_MODE) {
    console.log(
      `🧪 TEST_MODE: Application for ${platform} order ${id} suppressed.`
    );
    return { ok: true, applied: false, testMode: true };
  }

  try {
    if (platform === "FieldNation" && CONFIG.FIELDNATION_ENABLED) {
      await postFNworkOrderRequest(orderLink, startDateAndTime, estLaborHours);
      await sendWorkOrderMessage(orderLink);
      // Play success sound for FieldNation application
      playSound("applied");
      logger.info(
        `🔊 Sound notification: Application submitted for FieldNation job`,
        platform,
        id
      );
      return { ok: true, applied: true };
    } else if (platform === "FieldNation" && !CONFIG.FIELDNATION_ENABLED) {
      console.log("⏭️ FieldNation application skipped (platform disabled)");
      logger.info(
        `Action: Skipped - FieldNation platform disabled`,
        platform,
        id
      );
      return { ok: true, applied: false, skipped: true };
    }

    if (platform === "WorkMarket" && CONFIG.WORKMARKET_ENABLED) {
      await postWMworkOrderRequest(
        orderLink,
        startDateAndTime,
        estLaborHours,
        id
      );
      // Play success sound for WorkMarket application
      playSound("applied");
      logger.info(
        `🔊 Sound notification: Application submitted for WorkMarket job`,
        platform,
        id
      );
      return { ok: true, applied: true };
    } else if (platform === "WorkMarket" && !CONFIG.WORKMARKET_ENABLED) {
      console.log("⏭️ WorkMarket application skipped (platform disabled)");
      logger.info(
        `Action: Skipped - WorkMarket platform disabled`,
        platform,
        id
      );
      return { ok: true, applied: false, skipped: true };
    }

    return { ok: true, applied: false, skipped: true };
  } catch (error) {
    console.error("Error applying for the job:", error);
    // Play error sound on failure
    playSound("error");
    return { ok: false, applied: false, error };
  }
}

// Function to detect if WorkMarket data indicates expired cookies
function isInvalidWorkMarketData(data) {
  if (!data || data.platform !== "WorkMarket") {
    return false;
  }

  // Check for multiple indicators of invalid data
  const hasInvalidCompany =
    !data.company ||
    data.company === "Unknown Company" ||
    data.company.trim() === "";
  const hasInvalidTitle =
    !data.title || data.title === "No Title" || data.title.trim() === "";
  const hasInvalidPayment = data.totalPayment === 0 && data.hourlyRate === 0;
  const hasInvalidId = !data.id || data.id === "" || data.id === "unknown";

  // Only consider data invalid if multiple indicators are present
  // This prevents false positives with legitimate $0 jobs or missing single fields
  const invalidIndicators = [
    hasInvalidCompany,
    hasInvalidTitle,
    hasInvalidPayment,
    hasInvalidId,
  ].filter(Boolean).length;

  return invalidIndicators >= 2;
}

// Process the order: check requirements and apply if valid
async function processOrderInternal(orderLink) {
  try {
    const platform = determinePlatform(orderLink);

    // Check if platform is enabled
    if (platform === "FieldNation" && !CONFIG.FIELDNATION_ENABLED) {
      console.log(
        "⏭️ FieldNation order processing skipped (platform disabled)"
      );
      logger.info(
        `Action: Skipped - FieldNation platform disabled`,
        platform,
        "unknown"
      );
      telegramBot.sendMessage(
        `⏭️ FieldNation order skipped (platform disabled)`
      );
      pushEvent({
        platform: "FieldNation",
        status: "info",
        message: "Order skipped: Platform disabled",
      });
      return null;
    }

    if (platform === "WorkMarket" && !CONFIG.WORKMARKET_ENABLED) {
      console.log("⏭️ WorkMarket order processing skipped (platform disabled)");
      logger.info(
        `Action: Skipped - WorkMarket platform disabled`,
        platform,
        "unknown"
      );
      telegramBot.sendMessage(
        `⏭️ WorkMarket order skipped (platform disabled)`
      );
      pushEvent({
        platform: "WorkMarket",
        status: "info",
        message: "Order skipped: Platform disabled",
      });
      return null;
    }

    let data;

    if (platform === "FieldNation") {
      data = await getFNorderData(orderLink);
    } else if (platform === "WorkMarket") {
      data = await getWMorderData(orderLink);

      // Invalid data that is NOT an auth wall (e.g. an unavailable/taken ticket)
      // must be skipped WITHOUT re-login — otherwise every dead ticket triggers
      // a full 2FA re-login loop.
      if (isInvalidWorkMarketData(data) && !data?.authExpired) {
        console.log(
          "⏭️ WorkMarket ticket unavailable or unparseable (not an auth issue), skipping without re-login."
        );
        // logger.warn (not console.log) so this lands in logs/app-*.log — this
        // branch used to swallow orders with no trace in the log file at all.
        logger.warn(
          "Order skipped: ticket unavailable or unparseable (not an auth issue)",
          platform,
          data?.id || "unknown"
        );
        pushEvent({
          platform: "WorkMarket",
          status: "info",
          message: "Order skipped: Ticket unavailable",
        });
        return null;
      }

      // Only a genuine auth wall (authExpired) triggers a cookie refresh + retry
      if (data?.authExpired) {
        // Re-login is rate limited: with session detection now working, this
        // path fires often, and an unrecoverable login must not become a 2FA
        // storm. Queue the order instead so it is retried after the next
        // successful refresh.
        if (!isRefreshingCookies && !canRelogin()) {
          const waitSec = Math.ceil(reloginCooldownRemainingMs() / 1000);
          logger.warn(
            `WorkMarket session invalid but re-login is on cooldown for ${waitSec}s — queuing order for retry`,
            platform,
            data?.id || "unknown"
          );
          queueOrderForRetry(orderLink, data?.id, "re-login cooldown");
          pushEvent({
            platform: "WorkMarket",
            status: "info",
            message: "Order queued: re-login on cooldown",
          });
          return null;
        }

        // Prevent concurrent refresh attempts
        if (isRefreshingCookies) {
          console.log("⏳ Cookie refresh already in progress, waiting...");
          // Wait for refresh to complete (up to 60 seconds)
          let waitCount = 0;
          while (isRefreshingCookies && waitCount < 60) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            waitCount++;
          }

          // Retry fetching with (hopefully) fresh cookies
          console.log(
            "🔄 Retrying WorkMarket data fetch after waiting for refresh..."
          );
          data = await getWMorderData(orderLink);

          if (isInvalidWorkMarketData(data)) {
            console.error(
              "❌ Still invalid data after waiting for refresh. Skipping."
            );
            noteWmSessionFailure("still invalid after waiting for refresh");
            queueOrderForRetry(orderLink, data?.id, "invalid after refresh wait");
            pushEvent({
              platform: "WorkMarket",
              status: "error",
              message: "Auth Error: Still invalid after refresh wait",
            });
            return null;
          }

          console.log(
            "✅ Successfully retrieved WorkMarket data after waiting for refresh"
          );
        } else {
          // No refresh in progress, start one
          console.log(
            "🔄 Invalid WorkMarket data detected, refreshing cookies and retrying..."
          );
          logger.info(
            "Detected expired WorkMarket cookies, refreshing and retrying",
            platform,
            "unknown"
          );

          try {
            // Refresh cookies by re-logging into WorkMarket
            console.log("🔑 Re-logging into WorkMarket to refresh cookies...");

            // Use saveCookies() which properly initializes browser and logs into both platforms
            await refreshCookies("expired WorkMarket order session");

            console.log("✅ WorkMarket re-login successful, cookies refreshed");

            // Wait a bit for cookies to be saved
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Retry fetching the data
            console.log(
              "🔄 Retrying WorkMarket data fetch with fresh cookies..."
            );
            data = await getWMorderData(orderLink);

            // Check if retry was successful
            if (!data || isInvalidWorkMarketData(data)) {
              // Still invalid? Don't throw, just log it and move on to next email to avoid loop crash
              console.error(
                "❌ Still receiving invalid data after cookie refresh. Skipping this order."
              );
              noteWmSessionFailure("data still invalid after cookie refresh");
              queueOrderForRetry(orderLink, data?.id, "invalid after refresh");
              pushEvent({
                platform: "WorkMarket",
                status: "error",
                message: "Auth Error: Data still invalid after refresh",
              });
              return null;
            } else {
              console.log(
                "✅ Successfully retrieved WorkMarket data after cookie refresh"
              );
              logger.info(
                "Successfully retrieved data after cookie refresh",
                platform,
                data.id
              );
              // Session is healthy again — give previously dropped orders
              // another chance now rather than waiting for the next probe.
              consecutiveWmSessionFailures = 0;
              pendingRetryDrain = true;
            }
          } catch (refreshError) {
            console.error(
              "❌ Failed to refresh cookies or retry data fetch:",
              refreshError
            );
            logger.error(
              `Failed to refresh cookies: ${refreshError.message}`,
              platform,
              "unknown"
            );
            telegramBot.sendMessage(
              `❌ Failed to refresh WorkMarket cookies: ${refreshError.message}`
            );
            queueOrderForRetry(orderLink, data?.id, "cookie refresh failed");
            pushEvent({
              platform: "WorkMarket",
              status: "error",
              message: "Auth Error: Refresh failed",
            });
            return null;
          } finally {
            console.log("🔓 Cookie refresh lock released");
          }
        }
      }
    } else {
      throw new Error("Unsupported platform or invalid order link.");
    }

    if (!data) {
      console.error("Failed to retrieve order data.");
      // Another path that used to vanish from the log file entirely.
      logger.warn("Order dropped: failed to retrieve order data", platform);
      pushEvent({
        platform,
        status: "error",
        message: "Order dropped: no data returned",
      });
      return null;
    }

    const normalizedData = normalizeDateFromWO(data);

    // Log order details
    logger.info(
      `New Order - Platform: ${normalizedData.platform}, ID: ${
        normalizedData.id
      }
       Company: ${normalizedData.company}
       Title: ${normalizedData.title}
       Time: ${new Date(
         normalizedData.time.start
       ).toLocaleString()} - ${new Date(
         normalizedData.time.end
       ).toLocaleString()}
       Pay Range: $${normalizedData.payRange.min}-$${
         normalizedData.payRange.max
       }
       Est. Hours: ${normalizedData.estLaborHours}
       Distance: ${normalizedData.distance}mi`,
      normalizedData.platform,
      normalizedData.id
    );

    const eligibilityResult = await isEligibleForApplication(normalizedData);

    // Process the order based on eligibility
    if (eligibilityResult.eligible) {
      logger.info(
        `Action: Direct Application - Order meets all criteria`,
        normalizedData.platform,
        normalizedData.id
      );

      // Submit the application FIRST, then notify based on the real outcome.
      // Notifying before the request (or while swallowing its errors) is what
      // produced false "✅ APPLIED" messages when the apply never went through.
      const applyResult = await applyForJob(
        orderLink,
        normalizedData.time,
        normalizedData.estLaborHours,
        normalizedData.id
      );

      if (applyResult?.testMode) {
        telegramBot.sendOrderNotification(
          normalizedData,
          "🧪 TEST",
          "Matches criteria (not applied)",
          orderLink
        );
        pushEvent({
          platform: normalizedData.platform,
          id: normalizedData.id,
          title: normalizedData.title,
          status: "info",
          message: "TEST: Matches criteria (not applied)",
        });
      } else if (applyResult?.applied) {
        telegramBot.sendOrderNotification(
          normalizedData,
          "✅ APPLIED",
          "Order meets all criteria",
          orderLink
        );
        pushEvent({
          platform: normalizedData.platform,
          id: normalizedData.id,
          title: normalizedData.title,
          status: "success",
          message: "Applied for job (Criteria Met)",
        });
      } else {
        const failReason = applyResult?.skipped
          ? "Application skipped (platform disabled)"
          : `Application failed: ${applyResult?.error?.message || "unknown error"}`;
        logger.error(
          `Action: Direct Application FAILED - ${failReason}`,
          normalizedData.platform,
          normalizedData.id
        );
        telegramBot.sendOrderNotification(
          normalizedData,
          "⚠️ APPLY FAILED",
          failReason,
          orderLink
        );
        pushEvent({
          platform: normalizedData.platform,
          id: normalizedData.id,
          title: normalizedData.title,
          status: applyResult?.skipped ? "info" : "error",
          message: failReason,
        });
      }
    } else if (eligibilityResult.reason === "OUTSIDE_WORKING_HOURS") {
      // Do not send counter-offer for jobs outside working hours
      logger.info(
        `Action: No Action - Job is outside working hours (${CONFIG.TIME.WORK_START_TIME}-${CONFIG.TIME.WORK_END_TIME})`,
        normalizedData.platform,
        normalizedData.id
      );

      telegramBot.sendOrderNotification(
        normalizedData,
        "❌ REJECTED",
        "Outside working hours",
        orderLink
      );

      pushEvent({
        platform: normalizedData.platform,
        id: normalizedData.id,
        title: normalizedData.title,
        status: "error",
        message: "Rejected: Outside Working Hours",
      });
      playSound("error");
    } else if (eligibilityResult.reason === "SLOT_UNAVAILABLE") {
      logger.info(
        `Action: No Action - Calendar conflict detected`,
        normalizedData.platform,
        normalizedData.id
      );

      telegramBot.sendOrderNotification(
        normalizedData,
        "❌ REJECTED",
        "Calendar conflict",
        orderLink
      );

      pushEvent({
        platform: normalizedData.platform,
        id: normalizedData.id,
        title: normalizedData.title,
        status: "error",
        message: "Rejected: Calendar Conflict",
      });
      playSound("error");
    } else if (
      eligibilityResult.counterOffer &&
      (eligibilityResult.reason === "PAYMENT_INSUFFICIENT" ||
        eligibilityResult.reason === "TRAVEL_REQUIRED")
    ) {
      // Handle counter offers for both platforms
      if (normalizedData.platform === "FieldNation") {
        logger.info(
          `Action: Counter Offer - Adjusting rates and adding travel expenses`,
          normalizedData.platform,
          normalizedData.id
        );

        try {
          const co = eligibilityResult.counterOffer;
          const counterDetails =
            co.payType === "hourly"
              ? `Rate: $${co.counterRate}/hr × ${co.estHours}hrs = $${co.baseAmount}\nTravel: $${co.travelExpense}`
              : co.payType === "blended" && co.payStructure
                ? `Combined: $${co.payStructure.base.amount} base + $${co.payStructure.additional.amount}/hr × ${co.payStructure.additional.units}hr\nTravel: $${co.travelExpense}`
                : `Fixed: $${co.baseAmount}\nTravel: $${co.travelExpense}`;
          telegramBot.sendOrderNotification(
            normalizedData,
            "💰 COUNTER OFFER",
            counterDetails,
            orderLink
          );

          const counterStatus = CONFIG.TEST_MODE ? "info" : "warning";
          const counterMsg = CONFIG.TEST_MODE
            ? `TEST: Counter suggested: $${co.baseAmount} + $${co.travelExpense} travel`
            : `Sent FN Counter Offer: $${co.baseAmount}`;
          pushEvent({
            platform: normalizedData.platform,
            id: normalizedData.id,
            title: normalizedData.title,
            status: counterStatus,
            message: counterMsg,
          });

          if (!CONFIG.TEST_MODE) {
            await postFNCounterOffer(normalizedData.id, {
              payType: co.payType,
              baseAmount:
                co.payType === "hourly" ? co.counterRate : co.baseAmount,
              baseHours: co.payType === "hourly" ? co.estHours : 0,
              additionalHours: 0,
              additionalAmount: 0,
              travelExpense: co.travelExpense,
              estLaborHours: co.estHours,
              payStructure: co.payStructure,
            });
          }

          playSound("applied");
          logger.info(
            `Result: Counter offer sent successfully 🔊
             Type: ${co.payType}
             ${co.payType === "hourly" ? `Rate: $${co.counterRate}/hr × ${co.estHours}hrs` : `Fixed: $${co.baseAmount}`}
             Travel: $${co.travelExpense}`,
            normalizedData.platform,
            normalizedData.id
          );
        } catch (error) {
          logger.error(
            `Result: Failed to send counter offer - ${error.message}`,
            normalizedData.platform,
            normalizedData.id
          );
          telegramBot.sendMessage(
            `❌ Failed to send counter offer: ${error.message}`
          );
          playSound("error");
        }
      } else if (normalizedData.platform === "WorkMarket") {
        logger.info(
          `Action: Counter Offer - Adjusting rates and adding travel expenses`,
          normalizedData.platform,
          normalizedData.id
        );

        try {
          const co = eligibilityResult.counterOffer;
          const counterDetails =
            co.payType === "hourly"
              ? `Rate: $${co.counterRate}/hr × ${co.estHours}hrs = $${co.baseAmount}\nTravel: $${co.travelExpense}`
              : `Fixed: $${co.baseAmount}\nTravel: $${co.travelExpense}`;
          telegramBot.sendOrderNotification(
            normalizedData,
            "💰 COUNTER OFFER",
            counterDetails,
            orderLink
          );

          const counterStatus = CONFIG.TEST_MODE ? "info" : "warning";
          const counterMsg = CONFIG.TEST_MODE
            ? `TEST: Counter suggested: $${co.baseAmount} + $${co.travelExpense} travel`
            : `Sent WM Counter Offer: $${co.baseAmount}`;
          pushEvent({
            platform: normalizedData.platform,
            id: normalizedData.id,
            title: normalizedData.title,
            status: counterStatus,
            message: counterMsg,
          });

          if (!CONFIG.TEST_MODE) {
            await postWMCounterOffer(
              normalizedData.id,
              co.counterRate,
              co.estHours,
              normalizedData.distance,
              {
                payType: co.payType,
                baseAmount: co.baseAmount,
                travelExpense: co.travelExpense,
              }
            );
          }

          playSound("applied");
          logger.info(
            `Result: WM Counter offer sent 🔊 Type: ${co.payType}, Rate: $${co.counterRate}/hr, Total: $${co.baseAmount}, Travel: $${co.travelExpense}`,
            normalizedData.platform,
            normalizedData.id
          );
        } catch (error) {
          logger.error(
            `Result: Failed to send counter offer - ${error.message}`,
            normalizedData.platform,
            normalizedData.id
          );
          telegramBot.sendMessage(
            `❌ Failed to send counter offer: ${error.message}`
          );
          playSound("error");
        }
      }
    } else if (
      eligibilityResult.counterOffer &&
      eligibilityResult.reason === "COUNTER_DATES"
    ) {
      // Handle counter-offer with alternative time slot
      const slot = eligibilityResult.counterOffer.counterDate;
      const isSlotWindow =
        slot.durationMinutes > 0 &&
        slot.end instanceof Date &&
        slot.end.getTime() > slot.start.getTime();
      const slotTimeRange = isSlotWindow
        ? `${slot.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${slot.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${slot.durationMinutes}min)`
        : `${slot.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      const counterDateLabel = `📆 ${slot.start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} — ${slotTimeRange}`;
      const isRealWorkMarketSubmission =
        normalizedData.platform === "WorkMarket" && !CONFIG.TEST_MODE;

      logger.info(
        `Action: Counter Dates - Offering slot: ${counterDateLabel}`,
        normalizedData.platform,
        normalizedData.id
      );

      // Send a custom Telegram message with better formatting for counter dates
      const escapeHTML = value => telegramBot.escapeHTML(value);
      const orderIdLink = orderLink
        ? `<a href="${escapeHTML(orderLink)}">#${escapeHTML(normalizedData.id)}</a>`
        : `#${escapeHTML(normalizedData.id)}`;
      const payText =
        normalizedData.payRange.min === normalizedData.payRange.max
          ? `$${normalizedData.payRange.min}`
          : `$${normalizedData.payRange.min}–$${normalizedData.payRange.max}`;
      const counterOfferText =
        eligibilityResult.counterOffer.payType === "hourly"
          ? `$${eligibilityResult.counterOffer.counterRate}/hr × ${eligibilityResult.counterOffer.estHours}hrs = $${eligibilityResult.counterOffer.baseAmount}`
          : eligibilityResult.counterOffer.payType === "blended" &&
              eligibilityResult.counterOffer.payStructure
            ? `$${eligibilityResult.counterOffer.payStructure.base.amount} base + $${eligibilityResult.counterOffer.payStructure.additional.amount}/hr × ${eligibilityResult.counterOffer.payStructure.additional.units}hr`
            : `$${eligibilityResult.counterOffer.baseAmount} fixed`;
      const telegramMsg = [
        `<b>📅 COUNTER DATE</b> · ${escapeHTML(normalizedData.platform)} ${orderIdLink}`,
        `<b>${escapeHTML(normalizedData.company)}</b> — ${escapeHTML(normalizedData.title)}`,
        `💵 ${escapeHTML(payText)} · 📍 ${escapeHTML(normalizedData.distance)} mi`,
        `❌ Requested: ${escapeHTML(new Date(normalizedData.time.start).toLocaleString())} (conflict)`,
        `✅ Proposed: ${escapeHTML(counterDateLabel)}`,
        `💰 ${escapeHTML(counterOfferText)} + $${escapeHTML(eligibilityResult.counterOffer.travelExpense)} travel`,
        normalizedData.platform === "WorkMarket" && !isRealWorkMarketSubmission
          ? "<i>TEST mode: alternate date submission is simulated.</i>"
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      telegramBot.bot
        .sendMessage(telegramBot.chatId, telegramMsg, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        })
        .catch(err => {
          logger.error(
            `Failed to send counter dates notification: ${err.message}`
          );
          telegramBot.sendMessage(
            `📅 Counter Dates\n\nOrder: ${normalizedData.id}\nCompany: ${normalizedData.company}\nRequested: ${new Date(normalizedData.time.start).toLocaleString()}\n\nCounter Slot: ${counterDateLabel}\n\nCounter: $${eligibilityResult.counterOffer.baseAmount} + $${eligibilityResult.counterOffer.travelExpense} travel`
          );
        });

      const counterStatus = CONFIG.TEST_MODE ? "info" : "warning";
      const counterMsg = CONFIG.TEST_MODE
        ? `TEST: Schedule conflict, counter slot: ${counterDateLabel}`
        : `Attempting counter dates: ${counterDateLabel}`;
      pushEvent({
        platform: normalizedData.platform,
        id: normalizedData.id,
        title: normalizedData.title,
        status: counterStatus,
        message: counterMsg,
      });

      if (!CONFIG.TEST_MODE && normalizedData.platform === "WorkMarket") {
        try {
          const co = eligibilityResult.counterOffer;
          const wmCounterResult = await postWMCounterOffer(
            normalizedData.id,
            co.counterRate,
            co.estHours,
            normalizedData.distance,
            {
              counterDate: slot,
              payType: co.payType,
              baseAmount: co.baseAmount,
              travelExpense: co.travelExpense,
              rescheduleOption: normalizedData.isRequestedWindow
                ? "window"
                : "time",
              isRequestedWindow: Boolean(normalizedData.isRequestedWindow),
              note: "",
            }
          );
          pushEvent({
            platform: normalizedData.platform,
            id: normalizedData.id,
            title: normalizedData.title,
            status: "success",
            message: `WM counter dates submitted: ${counterDateLabel}`,
          });
          logger.info(
            `Result: WM counter date submitted successfully (status=${wmCounterResult?.status ?? "unknown"}, location=${wmCounterResult?.location ?? "n/a"})`,
            normalizedData.platform,
            normalizedData.id
          );
        } catch (error) {
          pushEvent({
            platform: normalizedData.platform,
            id: normalizedData.id,
            title: normalizedData.title,
            status: "error",
            message: `WM counter dates failed: ${error.message}`,
          });
          logger.error(
            `Result: Failed to send WM counter date - ${error.message}`,
            normalizedData.platform,
            normalizedData.id
          );
          telegramBot.sendMessage(
            `❌ Failed to send WorkMarket counter date: ${error.message}`
          );
          playSound("error");
          return;
        }
      }

      if (!CONFIG.TEST_MODE && normalizedData.platform === "FieldNation") {
        try {
          const co = eligibilityResult.counterOffer;
          await postFNCounterOffer(normalizedData.id, {
            payType: co.payType,
            baseAmount: co.payType === "hourly" ? co.counterRate : co.baseAmount,
            baseHours: co.payType === "hourly" ? co.estHours : 0,
            additionalHours: 0,
            additionalAmount: 0,
            travelExpense: co.travelExpense,
            estLaborHours: co.estHours,
            payStructure: co.payStructure,
            counterDate: slot,
          });
          pushEvent({
            platform: normalizedData.platform,
            id: normalizedData.id,
            title: normalizedData.title,
            status: "success",
            message: `FN counter dates submitted: ${counterDateLabel}`,
          });
          logger.info(
            `Result: FN counter date submitted successfully`,
            normalizedData.platform,
            normalizedData.id
          );
        } catch (error) {
          pushEvent({
            platform: normalizedData.platform,
            id: normalizedData.id,
            title: normalizedData.title,
            status: "error",
            message: `FN counter dates failed: ${error.message}`,
          });
          logger.error(
            `Result: Failed to send FN counter date - ${error.message}`,
            normalizedData.platform,
            normalizedData.id
          );
          telegramBot.sendMessage(
            `❌ Failed to send FieldNation counter date: ${error.message}`
          );
          playSound("error");
          return;
        }
      }

      playSound("applied");
    } else {
      // Handle all other rejection cases
      let rejectReason = "Unknown reason";
      switch (eligibilityResult.reason) {
        case "PAYMENT_INSUFFICIENT":
          rejectReason = `Payment below minimum threshold${
            eligibilityResult.rejectDetails
              ? `\nReason: ${eligibilityResult.rejectDetails}`
              : ""
          }`;
          break;
        case "PAYMENT_BELOW_MINIMUM":
          rejectReason = CONFIG.STRATEGY?.ENABLED
            ? "💸 Below lead-time threshold — not worth booking at this horizon"
            : `Payment below minimum threshold${
                eligibilityResult.rejectDetails
                  ? `\nReason: ${eligibilityResult.rejectDetails}`
                  : ""
              }`;
          break;
        case "SLOT_UNAVAILABLE":
          rejectReason = "Time slot unavailable";
          break;
        case "OUTSIDE_WORKING_HOURS":
          rejectReason = "Outside working hours";
          break;
        case "MODE_DISABLED":
          rejectReason = "Application mode is disabled";
          break;
        case "POLICY_REJECTED":
          rejectReason =
            eligibilityResult.rejectDetails ||
            "Rejected by company/date application policy";
          break;
        case "WO_IN_PAST":
          rejectReason =
            eligibilityResult.rejectDetails ||
            "Work order requested time is in the past";
          break;
        default:
          rejectReason = eligibilityResult.reason;
      }

      logger.info(
        `Action: No Action - Order does not meet criteria (Reason: ${eligibilityResult.reason})`,
        normalizedData.platform,
        normalizedData.id
      );

      telegramBot.sendOrderNotification(
        normalizedData,
        "❌ REJECTED",
        rejectReason,
        orderLink
      );

      pushEvent({
        platform: normalizedData.platform,
        id: normalizedData.id,
        title: normalizedData.title,
        status: "error",
        message: `Rejected: ${rejectReason}`,
      });
      playSound("error");
    }
    let availableBlocks = [];
    let busyBlocks = [];
    const snapshot = eligibilityResult._availabilitySnapshot;
    if (snapshot) {
      // Eligibility already checked availability — reuse those blocks, no refetch.
      availableBlocks = snapshot.availableBlocks;
      busyBlocks = snapshot.busyBlocks;
      delete eligibilityResult._availabilitySnapshot;
    } else {
      // Eligibility short-circuited before the availability check (e.g. WO in
      // past, payment below min, policy). Fetch once so replay still logs them.
      try {
        const woDateString = getWorkOrderLocalDate(normalizedData);
        const blocks = await getAvailableBlocks({
          date: woDateString,
          daysToCheck: 4,
          withBusy: true,
        });
        availableBlocks = blocks.free;
        busyBlocks = blocks.busy;
      } catch (blocksError) {
        logger.error(
          `Failed to compute available blocks for replay: ${blocksError.message}`,
          normalizedData.platform,
          normalizedData.id
        );
      }
    }
    await saveReplay(
      normalizedData,
      eligibilityResult,
      availableBlocks,
      busyBlocks
    );
    return normalizedData;
  } catch (error) {
    console.error("Error processing order:", error);
    telegramBot.sendMessage(`❌ Error processing order: ${error.message}`);
    return null;
  }
}

async function processOrder(orderLink) {
  const key = buildOrderProcessingKey(orderLink);
  const now = Date.now();
  pruneRecentlyProcessedOrders(now);

  if ((recentlyProcessedOrders.get(key) || 0) > now) {
    logger.info(`Duplicate order skipped within dedup window (${key})`);
    return null;
  }

  const existing = inFlightOrders.get(key);
  if (existing) {
    logger.info(`Duplicate order joined existing processing (${key})`);
    return existing;
  }

  const processingPromise = processOrderInternal(orderLink)
    .then(result => {
      if (result !== null) {
        recentlyProcessedOrders.set(key, Date.now() + ORDER_DEDUP_TTL_MS);
      }
      return result;
    })
    .finally(() => {
      inFlightOrders.delete(key);
    });

  inFlightOrders.set(key, processingPromise);
  return processingPromise;
}

// Set up Telegram bot event handlers
telegramBot.onStartMonitoring = startMonitoring;
telegramBot.onStopMonitoring = stopMonitoring;
telegramBot.onProcessOrder = processOrder;
// Manual /relogin: refresh cookies, then replay anything dropped while the
// session was dead, so a hand-triggered fix also recovers the lost orders.
telegramBot.onRelogin = async () => {
  await refreshCookies("manual Telegram command");
  consecutiveWmSessionFailures = 0;
  await drainWmRetryQueue();
};
telegramBot.onPhoneAlert = handlePhoneAlert;

// Periodic zombie Chrome cleanup (runs every 30 minutes)
setInterval(
  async () => {
    console.log("🧹 Running periodic zombie Chrome cleanup...");
    await cleanupChromeProcesses();
  },
  30 * 60 * 1000
);

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);

  // Clean up any zombies from previous runs on startup
  await cleanupChromeProcesses();

  telegramBot.sendMessage(
    `🚀 Server started on port ${port}\nMonitoring auto-started ✅\nUse /help for available commands or the menu button (☰) for quick access`
  );
  // Initialize logs.json with current eventHistory
  await writeEventsToFile(eventHistory);

  // Refresh cookies on startup so we never run with a stale session
  console.log("🔑 Refreshing platform cookies on startup...");
  try {
    await refreshCookies("startup");
    console.log("✅ Startup cookie refresh complete");
  } catch (err) {
    console.error("❌ Startup cookie refresh failed:", err.message);
    telegramBot.sendMessage(
      `❌ Startup cookie refresh failed: ${err.message}\nMonitoring will start but availability checks may fail until cookies are refreshed.`
    );
  }

  // Auto-start monitoring on server launch
  startMonitoring();

  // Start the 4-hour rotation timer after the initial refresh
  scheduleRelogin();

  // The WM session dies well before the 4-hour rotation; the probe closes that
  // gap by noticing the expiry between orders instead of during one.
  scheduleSessionProbe();
  console.log(
    "⏰ Cookie refresh: startup + every 4 hours, with on-demand fallback"
  );
});
