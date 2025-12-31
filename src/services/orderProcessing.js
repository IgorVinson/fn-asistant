import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";
import normalizeDateFromWO from "../utils/normalizedDateFromWO.js"; // Wait, where is this? utils/normalizedDateFromWO.js -> src/utils/normalizedDateFromWO.js ? 
import playSound from "../utils/playSound.js";
import telegramBot from "../utils/telegram/telegramBot.js";
// Step 41 mv utils/*.js src/utils/. So it should be src/utils/normalizedDateFromWO.js
// But imports in index.js were from "./utils/normalizedDateFromWO.js".
// So it is in src/utils/normalizedDateFromWO.js.
// However, I moved it to src/utils/.
// Let me verify where normalizedDateFromWO.js is.
// It was in utils/normalizedDateFromWO.js.
// Step 41 moved it to src/utils.
import isEligibleForApplication from "./isEligibleForApplication.js";

// Platform imports
import { getFNorderData } from "./platforms/fieldnation/getFNorderData.js"; // moved from utils/FieldNation
import { postFNCounterOffer } from "./platforms/fieldnation/postFNCounterOffer.js";
import { postFNworkOrderRequest } from "./platforms/fieldnation/postFNworkOrderRequest.js";
import { sendWorkOrderMessage } from "./platforms/fieldnation/sendWorkOrderMessage.js";

import { getWMorderData } from "./platforms/workmarket/getWMorderData.js";
import { postWMCounterOffer } from "./platforms/workmarket/postWMCounterOffer.js";
import { postWMworkOrderRequest } from "./platforms/workmarket/postWMworkOrderRequest.js";

import { saveCookies } from "../jobs/relogin.js"; // For cookie refresh

function determinePlatform(orderLink) {
  if (orderLink.includes("fieldnation")) {
    return "FieldNation";
  } else if (orderLink.includes("workmarket")) {
    return "WorkMarket";
  }
  return null;
}

// Function to detect if WorkMarket data indicates expired cookies
function isInvalidWorkMarketData(data) {
  if (!data || data.platform !== "WorkMarket") {
    return false;
  }

  const hasInvalidCompany =
    !data.company ||
    data.company === "Unknown Company" ||
    data.company.trim() === "";
  const hasInvalidTitle =
    !data.title || data.title === "No Title" || data.title.trim() === "";
  const hasInvalidPayment = data.totalPayment === 0 && data.hourlyRate === 0;
  const hasInvalidId = !data.id || data.id === "" || data.id === "unknown";

  const invalidIndicators = [
    hasInvalidCompany,
    hasInvalidTitle,
    hasInvalidPayment,
    hasInvalidId,
  ].filter(Boolean).length;

  return invalidIndicators >= 2;
}

async function applyForJob(orderLink, startDateAndTime, estLaborHours, id) {
  const platform = determinePlatform(orderLink);

  try {
    if (platform === "FieldNation" && CONFIG.FIELDNATION_ENABLED) {
      await postFNworkOrderRequest(orderLink, startDateAndTime, estLaborHours);
      await sendWorkOrderMessage(orderLink);
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
    playSound("error");
  }
}

export async function processOrder(orderLink) {
  try {
    const platform = determinePlatform(orderLink);

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

      if (isInvalidWorkMarketData(data)) {
        console.log(
          "🔄 Invalid WorkMarket data detected, refreshing cookies and retrying..."
        );
        logger.info(
          "Detected expired WorkMarket cookies, refreshing and retrying",
          platform,
          "unknown"
        );
        
        telegramBot.sendMessage(
          "🔄 WorkMarket cookies expired, refreshing..."
        );

        try {
          console.log("🍪 Starting cookie refresh process...");
          await saveCookies(true);
          console.log("✅ Cookie refresh completed");

          const waitTime = CONFIG.COOKIE_REFRESH.WAIT_AFTER_REFRESH_MS;
          console.log(`⏳ Waiting ${waitTime/1000} seconds for cookies to be saved to disk...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));

          console.log(
            "🔄 Retrying WorkMarket data fetch with fresh cookies..."
          );
          data = await getWMorderData(orderLink);

          if (isInvalidWorkMarketData(data)) {
            console.error("❌ Still receiving invalid data:", {
              company: data.company,
              title: data.title,
              totalPayment: data.totalPayment,
              hourlyRate: data.hourlyRate,
              id: data.id
            });
            throw new Error(
              "Still receiving invalid data after cookie refresh. Please check if cookies are being saved correctly."
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
            telegramBot.sendMessage(
              "✅ WorkMarket cookies refreshed successfully"
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

    if (eligibilityResult.eligible) {
      if (CONFIG.TEST_MODE) {
        logger.info(
          `TEST MODE: Would have applied to job`,
          normalizedData.platform,
          normalizedData.id
        );
        telegramBot.sendOrderNotification(
          normalizedData,
          "🧪 TEST MODE: APPLIED",
          "Simulated application (Dry Run)",
          orderLink
        );
      } else {
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
      }
    } else if (eligibilityResult.reason === "OUTSIDE_WORKING_HOURS") {
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
      if (normalizedData.platform === "FieldNation") {
        logger.info(
          `Action: Counter Offer - Adjusting rates and adding travel expenses`,
          normalizedData.platform,
          normalizedData.id
        );

        if (CONFIG.TEST_MODE) {
           logger.info(
            `TEST MODE: Would have sent counter offer`,
            normalizedData.platform,
            normalizedData.id
          );
           const counterDetails = `Base: $${eligibilityResult.counterOffer.baseAmount}\nTravel: $${eligibilityResult.counterOffer.travelExpense}`;
           telegramBot.sendOrderNotification(
            normalizedData,
            "🧪 TEST MODE: COUNTER",
            counterDetails + "\n(Simulated)",
            orderLink
          );
        } else {
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
        }
      } else if (normalizedData.platform === "WorkMarket") {
        logger.info(
          `Action: Counter Offer - Adjusting rates and adding travel expenses`,
          normalizedData.platform,
          normalizedData.id
        );

        if (CONFIG.TEST_MODE) {
             logger.info(
                `TEST MODE: Would have sent counter offer`,
                normalizedData.platform,
                normalizedData.id
              );
             const counterDetails = `Base: $${eligibilityResult.counterOffer.baseAmount}\nTravel: $${eligibilityResult.counterOffer.travelExpense}`;
             telegramBot.sendOrderNotification(
                normalizedData,
                "🧪 TEST MODE: COUNTER",
                 counterDetails + "\n(Simulated)",
                orderLink
              );
        } else {
            try {
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
      }
    } else {
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
