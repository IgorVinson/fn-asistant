import express from "express";
import { google } from "googleapis";
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
import telegramBot from "./utils/telegram/telegramBot.js";
import { getWMorderData } from "./utils/WorkMarket/getWMorderData.js";
import { loginWMAuto } from "./utils/WorkMarket/loginWMAuto.js";
import { postWMCounterOffer } from "./utils/WorkMarket/postWMCounterOffer.js";
import { postWMworkOrderRequest } from "./utils/WorkMarket/postWMworkOrderRequest.js";

// Configure the server
const app = express();
const port = 3001;

let browser; // Declare a browser instance
let reloginTimeout; // Timeout for the relogin scheduler
let monitoringInterval; // Store the monitoring interval

// Function to schedule a relogin with a 4-hour interval + random variance
function scheduleRelogin() {
  // Clear any existing timeout
  if (reloginTimeout) {
    clearTimeout(reloginTimeout);
  }

  // Base interval: 4 hours in milliseconds
  const baseInterval = 4 * 60 * 60 * 1000;

  // Random variance: +/- 10 minutes in milliseconds
  const variance = (Math.random() * 20 - 10) * 60 * 1000;

  // Calculate the next relogin time
  const nextReloginTime = baseInterval + variance;

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

    // Close the existing browser instance if it exists
    if (browser) {
      try {
        await browser.close();
        console.log("🔒 Closed existing browser instance");
      } catch (err) {
        console.error("Error closing browser:", err);
      }
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

  monitoringInterval = setInterval(async () => {
    if (!telegramBot.isMonitoring) {
      return; // Skip if monitoring is disabled via Telegram
    }

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
      return null;
    }

    let data;

    if (platform === "FieldNation") {
      data = await getFNorderData(orderLink);
    } else if (platform === "WorkMarket") {
      data = await getWMorderData(orderLink);

      // Check if data indicates expired cookies and retry with fresh cookies
      if (isInvalidWorkMarketData(data)) {
        console.log(
          "🔄 Invalid WorkMarket data detected, refreshing cookies and retrying..."
        );
        logger.info(
          "Detected expired WorkMarket cookies, refreshing and retrying",
          platform,
          "unknown"
        );

        try {
          // Refresh cookies using saveCookies function
          await saveCookies();

          // Wait a bit for cookies to be saved
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Retry fetching the data
          console.log(
            "🔄 Retrying WorkMarket data fetch with fresh cookies..."
          );
          data = await getWMorderData(orderLink);

          // Check if retry was successful
          if (isInvalidWorkMarketData(data)) {
            throw new Error(
              "Still receiving invalid data after cookie refresh"
            );
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
          return null;
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
      playSound("error");
    } else if (
      eligibilityResult.counterOffer &&
      eligibilityResult.reason === "PAYMENT_INSUFFICIENT"
    ) {
      // Handle counter offers for both platforms
      if (normalizedData.platform === "FieldNation") {
        logger.info(
          `Action: Counter Offer - Adjusting rates and adding travel expenses`,
          normalizedData.platform,
          normalizedData.id
        );

        try {
          await postFNCounterOffer(
            normalizedData.id,
            eligibilityResult.counterOffer.baseAmount,
            eligibilityResult.counterOffer.travelExpense,
            eligibilityResult.counterOffer.payType,
            eligibilityResult.counterOffer.baseHours,
            eligibilityResult.counterOffer.additionalHours,
            eligibilityResult.counterOffer.additionalAmount
          );

          const counterDetails = `Base: $${eligibilityResult.counterOffer.baseAmount}\nTravel: $${eligibilityResult.counterOffer.travelExpense}`;
          telegramBot.sendOrderNotification(
            normalizedData,
            "💰 COUNTER OFFER",
            counterDetails,
            orderLink
          );
          playSound("applied");
          logger.info(
            `Result: Counter offer sent successfully 🔊
             Base: $${eligibilityResult.counterOffer.baseAmount} (${eligibilityResult.counterOffer.baseHours}hr)
             Additional: $${eligibilityResult.counterOffer.additionalAmount}/hr (${eligibilityResult.counterOffer.additionalHours}hr)
             Travel: $${eligibilityResult.counterOffer.travelExpense}`,
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
          // Calculate proper hourly rate for WorkMarket counter offer
          const hourlyRate = Math.ceil(
            eligibilityResult.counterOffer.baseAmount /
              normalizedData.estLaborHours
          );

          await postWMCounterOffer(
            normalizedData.id,
            hourlyRate,
            normalizedData.estLaborHours,
            normalizedData.distance
          );

          const counterDetails = `Base: $${eligibilityResult.counterOffer.baseAmount}\nTravel: $${eligibilityResult.counterOffer.travelExpense}`;
          telegramBot.sendOrderNotification(
            normalizedData,
            "💰 COUNTER OFFER",
            counterDetails,
            orderLink
          );
          playSound("applied");
          logger.info(
            `Result: Counter offer sent successfully with travel expenses 🔊`,
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
    } else {
      // Handle all other rejection cases
      let rejectReason = "Unknown reason";
      switch (eligibilityResult.reason) {
        case "PAYMENT_INSUFFICIENT":
          rejectReason = "Payment below minimum threshold";
          break;
        case "SLOT_UNAVAILABLE":
          rejectReason = "Time slot unavailable";
          break;
        case "OUTSIDE_WORKING_HOURS":
          rejectReason = "Outside working hours";
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
      playSound("error");
    }

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

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  telegramBot.sendMessage(
    `🚀 Server started on port ${port}\nUse /help for available commands or the menu button (☰) for quick access`
  );
  // Remove the showMainMenu call since we now use persistent menu
  // await saveCookies();
  await periodicCheck(); // Don't auto-start, wait for Telegram command
  // scheduleRelogin();
});
