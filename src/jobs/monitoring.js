import { google } from "googleapis";
import { CONFIG } from "../../config/config.js";
import { processOrder } from "../services/orderProcessing.js"; // We need to create this service!
import { getLastUnreadEmail } from "../services/platforms/gmail/getLastUnreadEmail.js";
import { getOrderLink } from "../services/platforms/gmail/getOrderLink.js";
import { authorize } from "../services/platforms/gmail/login.js";
import playSound from "../utils/playSound.js";
import telegramBot from "../utils/telegram/telegramBot.js";

let monitoringInterval;

export async function periodicCheck() {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  console.log("Starting to monitor for new job orders...");
  telegramBot.sendMessage("🚀 Job monitoring started!");
  playSound("notification");

  monitoringInterval = setInterval(async () => {
    if (!telegramBot.isMonitoring) {
      return; 
    }

    try {
      const lastEmailBody = await getLastUnreadEmail(auth, gmail);
      if (lastEmailBody) {
        console.log("Email body received.");
        const orderLink = extractOrderLink(lastEmailBody);
        if (orderLink) {
          console.log("Order link extracted:", orderLink);
          await processOrder(orderLink);

          await new Promise(resolve => setTimeout(resolve, CONFIG.MONITORING.SOUND_DELAY_MS));
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
  }, CONFIG.MONITORING.INTERVAL_MS);
}

export function startMonitoring() {
  if (!monitoringInterval) {
    periodicCheck();
  }
  telegramBot.isMonitoring = true;
}

export function stopMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  telegramBot.isMonitoring = false;
  telegramBot.sendMessage("⏹️ Job monitoring stopped!");
}

function extractOrderLink(emailBody) {
  try {
    return getOrderLink(emailBody);
  } catch (error) {
    console.error("Error extracting order link:", error);
    return null;
  }
}
