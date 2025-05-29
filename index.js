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
import { getWMorderData } from "./utils/WorkMarket/getWMorderData.js";
import { loginWMAuto } from "./utils/WorkMarket/loginWMAuto.js";
import { postWMCounterOffer } from "./utils/WorkMarket/postWMCounterOffer.js";
import { postWMworkOrderRequest } from "./utils/WorkMarket/postWMworkOrderRequest.js";

// Configure the server
const app = express();
const port = 3001;

let browser; // Declare a browser instance
let reloginTimeout; // Timeout for the relogin scheduler

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

    // Login to WorkMarket with the new automated system
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
  playSound("notification");

  setInterval(async () => {
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
    }
  }, 1000); // Check every sec
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
    if (platform === "FieldNation") {
      await postFNworkOrderRequest(orderLink, startDateAndTime, estLaborHours);
      await sendWorkOrderMessage(orderLink);
      // Play success sound for FieldNation application
      playSound("applied");
      logger.info(
        `🔊 Sound notification: Application submitted for FieldNation job`,
        platform,
        id
      );
    }

    if (platform === "WorkMarket") {
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
    }
  } catch (error) {
    console.error("Error applying for the job:", error);
    // Play error sound on failure
    playSound("error");
  }
}

// Process the order: check requirements and apply if valid
async function processOrder(orderLink) {
  try {
    const platform = determinePlatform(orderLink);
    let data;

    if (platform === "FieldNation") {
      data = await getFNorderData(orderLink);
    } else if (platform === "WorkMarket") {
      data = await getWMorderData(orderLink);
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

      // Sound for rejection
      playSound("error");
    } else if (
      normalizedData.platform === "WorkMarket" &&
      normalizedData.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES &&
      eligibilityResult.reason === "PAYMENT_INSUFFICIENT"
    ) {
      logger.info(
        `Action: Counter Offer - Adding travel expenses for ${normalizedData.distance} miles`,
        normalizedData.platform,
        normalizedData.id
      );

      try {
        await postWMCounterOffer(
          normalizedData.id,
          normalizedData.payRange.min,
          normalizedData.estLaborHours,
          normalizedData.distance
        );

        // Sound for counter-offer
        playSound("applied");
        logger.info(
          `Result: Counter offer sent successfully with $${Math.round(
            normalizedData.distance
          )} travel expenses 🔊`,
          normalizedData.platform,
          normalizedData.id
        );
      } catch (error) {
        logger.error(
          `Result: Failed to send counter offer - ${error.message}`,
          normalizedData.platform,
          normalizedData.id
        );
        playSound("error");
      }
    } else if (
      eligibilityResult.counterOffer &&
      eligibilityResult.reason === "PAYMENT_INSUFFICIENT"
    ) {
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

          // Sound for counter-offer
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
          playSound("error");
        }
      }
    } else {
      logger.info(
        `Action: No Action - Order does not meet criteria (Reason: ${eligibilityResult.reason})`,
        normalizedData.platform,
        normalizedData.id
      );

      // All rejections use error sound
      console.log(
        `DEBUG: Playing error sound for ${normalizedData.platform} order ${normalizedData.id}, reason: ${eligibilityResult.reason}`
      );
      playSound("error");
    }

    return normalizedData;
  } catch (error) {
    console.error("Error processing order:", error);
    return null;
  }
}

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  // await saveCookies();
  await periodicCheck();
  // scheduleRelogin();
});
