import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "fs/promises";
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
import logger from "./utils/logger.js";
import normalizeDateFromWO from "./utils/normalizedDateFromWO.js";
import playSound from "./utils/playSound.js";
import { saveReplay } from "./utils/saveReplay.js";
import telegramBot from "./utils/telegram/telegramBot.js";
import { getWMorderData } from "./utils/WorkMarket/getWMorderData.js";
import { loginWMAuto } from "./utils/WorkMarket/loginWMAuto.js";
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
let isRefreshingCookies = false; // Flag to prevent concurrent cookie refresh attempts
const phoneAlertDedup = new Map();

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
      // Kill Chrome for Testing processes
      execSync('pkill -9 -f "Google Chrome for Testing" 2>/dev/null');
      // Also try regular Chrome if spawned
      execSync('pkill -9 -f "Google Chrome Helper" 2>/dev/null');
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
    await saveCookies();
    // Schedule the next relogin after this one completes
    scheduleRelogin();
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

// Initialize Puppeteer and log in to FieldNation and WorkMarket
async function saveCookies() {
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
      }
    } else {
      console.log("⏭️ WorkMarket login skipped (disabled)");
    }

    console.log("🍪 Login process completed, cookies saved automatically");
  } catch (error) {
    console.error("❌ Error during automated login process:", error);
  }
}

// Periodically check for unread emails
async function periodicCheck() {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  // Initial announcement sound
  console.log("Starting to monitor for new job orders...");
  telegramBot.sendMessage("🚀 Job monitoring started!");
  playSound("notification");

  let isCheckingEmail = false;

  monitoringInterval = setInterval(async () => {
    if (!telegramBot.isMonitoring) {
      return; // Skip if monitoring is disabled via Telegram
    }

    // Do not proceed with email check if cookies are being refreshed
    if (isRefreshingCookies) {
      return;
    }

    // Do not overlap email processing requests
    if (isCheckingEmail) {
      return;
    }

    isCheckingEmail = true;

    try {
      const lastEmailBody = await getLastUnreadEmail(auth, gmail);
      if (lastEmailBody) {
        console.log("Email body received.");
        const orderLink = extractOrderLink(lastEmailBody);
        if (orderLink) {
          console.log("Order link extracted:", orderLink);
          await processOrder(orderLink);

          // Add a delay to ensure sounds can finish playing
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.log("No valid order link found in email.");
        }
      } else {
        console.log("No unread emails found.");
      }
    } catch (error) {
      console.error("Error during email check:", error);
      telegramBot.sendMessage(`❌ Error during monitoring: ${error.message}`);
    } finally {
      isCheckingEmail = false;
    }
  }, 1000); // Check every sec
}

function startMonitoring() {
  if (!monitoringInterval) {
    periodicCheck();
  }
  telegramBot.isMonitoring = true;
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
    return;
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
    } else if (platform === "FieldNation" && !CONFIG.FIELDNATION_ENABLED) {
      console.log("⏭️ FieldNation application skipped (platform disabled)");
      logger.info(
        `Action: Skipped - FieldNation platform disabled`,
        platform,
        id
      );
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
    } else if (platform === "WorkMarket" && !CONFIG.WORKMARKET_ENABLED) {
      console.log("⏭️ WorkMarket application skipped (platform disabled)");
      logger.info(
        `Action: Skipped - WorkMarket platform disabled`,
        platform,
        id
      );
    }
  } catch (error) {
    console.error("Error applying for the job:", error);
    // Play error sound on failure
    playSound("error");
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
async function processOrder(orderLink) {
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

      // Check if data indicates expired cookies and retry with fresh cookies
      if (isInvalidWorkMarketData(data)) {
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
          isRefreshingCookies = true;
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
            await saveCookies();

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
            pushEvent({
              platform: "WorkMarket",
              status: "error",
              message: "Auth Error: Refresh failed",
            });
            return null;
          } finally {
            // Always reset the flag when done
            isRefreshingCookies = false;
            console.log("🔓 Cookie refresh lock released");
          }
        }
      }
    } else {
      throw new Error("Unsupported platform or invalid order link.");
    }

    if (!data) {
      console.error("Failed to retrieve order data.");
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

      telegramBot.sendOrderNotification(
        normalizedData,
        "✅ APPLIED",
        "Order meets all criteria",
        orderLink
      );

      const appStatus = CONFIG.TEST_MODE ? "info" : "success";
      const appMsg = CONFIG.TEST_MODE
        ? "TEST: Matches criteria (not applied)"
        : "Applied for job (Criteria Met)";
      pushEvent({
        platform: normalizedData.platform,
        id: normalizedData.id,
        title: normalizedData.title,
        status: appStatus,
        message: appMsg,
      });

      await applyForJob(
        orderLink,
        normalizedData.time,
        normalizedData.estLaborHours,
        normalizedData.id
      );
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
            await postFNCounterOffer(
              normalizedData.id,
              co.baseAmount,
              co.travelExpense,
              co.payType,
              co.payType === "hourly" ? 0 : co.estHours,
              0,
              co.counterRate
            );
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
              normalizedData.distance
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
      const slotTimeRange = `${slot.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${slot.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} (${slot.durationMinutes}min)`;
      const counterDateLabel = `📆 ${slot.start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} — ${slotTimeRange}`;
      const isRealWorkMarketSubmission =
        normalizedData.platform === "WorkMarket" && !CONFIG.TEST_MODE;

      logger.info(
        `Action: Counter Dates - Offering slot: ${counterDateLabel}`,
        normalizedData.platform,
        normalizedData.id
      );

      // Send a custom Telegram message with better formatting for counter dates
      const modesLabel = telegramBot.getActiveModesHTML();
      const orderIdLink = orderLink
        ? `<a href="${orderLink}">${normalizedData.id}</a>`
        : normalizedData.id;

      const telegramMsg = `📅 <b>Counter Dates</b>${modesLabel}

<b>Platform:</b> ${normalizedData.platform}
<b>Order ID:</b> ${orderIdLink}
<b>Company:</b> ${normalizedData.company}
<b>Title:</b> ${normalizedData.title}
<b>Pay:</b> $${normalizedData.payRange.min}-$${normalizedData.payRange.max}
<b>Distance:</b> ${normalizedData.distance}mi

<b>Requested:</b> ${new Date(normalizedData.time.start).toLocaleString()}
❌ <i>Conflict with existing schedule</i>

<b>✅ Counter Slot:</b> ${counterDateLabel}
${normalizedData.platform === "WorkMarket" && !isRealWorkMarketSubmission ? "\n\n<i>WorkMarket alternate date submission will be simulated in TEST mode only.</i>" : ""}

<b>Counter Offer:</b> ${eligibilityResult.counterOffer.payType === "hourly" ? `$${eligibilityResult.counterOffer.counterRate}/hr × ${eligibilityResult.counterOffer.estHours}hrs = $${eligibilityResult.counterOffer.baseAmount}` : `$${eligibilityResult.counterOffer.baseAmount} (fixed)`} + $${eligibilityResult.counterOffer.travelExpense} travel`;

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
        : `Counter dates sent: ${counterDateLabel}`;
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
          await postWMCounterOffer(
            normalizedData.id,
            co.counterRate,
            co.estHours,
            normalizedData.distance,
            {
              counterDate: slot,
              note: `Requesting alternate date/time due to schedule conflict: ${counterDateLabel}`,
            }
          );
          logger.info(
            `Result: WM counter date submitted successfully`,
            normalizedData.platform,
            normalizedData.id
          );
        } catch (error) {
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
    await saveReplay(normalizedData, eligibilityResult);
    return normalizedData;
  } catch (error) {
    console.error("Error processing order:", error);
    telegramBot.sendMessage(`❌ Error processing order: ${error.message}`);
    return null;
  }
}

// Set up Telegram bot event handlers
telegramBot.onStartMonitoring = startMonitoring;
telegramBot.onStopMonitoring = stopMonitoring;
telegramBot.onProcessOrder = processOrder;
telegramBot.onRelogin = saveCookies;
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

  // Auto-start monitoring on server launch
  startMonitoring();

  // No scheduled refresh - cookies are refreshed on-demand when they expire
  console.log(
    "⏰ On-demand cookie refresh enabled (refresh only when expired)"
  );
});
