import puppeteer from "puppeteer";
import { CONFIG } from "../../config/config.js";
import { loginFnAuto } from "../services/platforms/fieldnation/loginFnAuto.js";
import { authorize } from "../services/platforms/gmail/login.js";
import { loginWMAuto } from "../services/platforms/workmarket/loginWMAuto.js";

let browser;
let reloginTimeout;

export async function saveCookies() {
  try {
    console.log("🚀 Starting automated login process...");

    if (browser) {
      try {
        await browser.close();
        console.log("🔒 Closed existing browser instance");
      } catch (err) {
        console.error("Error closing browser:", err);
      }
    }

    browser = await puppeteer.launch({
      headless: CONFIG.BROWSER.HEADLESS,
      args: CONFIG.BROWSER.ARGS,
    });

    const gmailAuth = await authorize();

    if (CONFIG.FIELDNATION_ENABLED) {
      console.log("🔑 Logging into FieldNation...");
      const fnResult = await loginFnAuto(
        browser,
        CONFIG.LOGIN.FIELDNATION.EMAIL,
        CONFIG.LOGIN.FIELDNATION.PASSWORD,
        null,
        CONFIG.LOGIN.WAIT_FOR_CODE,
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

    if (CONFIG.WORKMARKET_ENABLED) {
      console.log("🔑 Logging into WorkMarket...");
      const wmResult = await loginWMAuto(
        browser,
        CONFIG.LOGIN.WORKMARKET.EMAIL,
        CONFIG.LOGIN.WORKMARKET.PASSWORD,
        null,
        CONFIG.LOGIN.WAIT_FOR_CODE,
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

export function scheduleRelogin() {
  if (!CONFIG.RELOGIN.ENABLED) {
    console.log("⏸️ Relogin scheduler is disabled in config");
    return;
  }

  if (reloginTimeout) {
    clearTimeout(reloginTimeout);
  }

  const baseInterval = CONFIG.RELOGIN.INTERVAL_HOURS * 60 * 60 * 1000;
  const variance = (Math.random() * (CONFIG.RELOGIN.VARIANCE_MINUTES * 2) - CONFIG.RELOGIN.VARIANCE_MINUTES) * 60 * 1000;
  const nextReloginTime = baseInterval + variance;

  reloginTimeout = setTimeout(async () => {
    console.log("⏰ Scheduled relogin triggered...");
    await saveCookies();
    scheduleRelogin();
  }, nextReloginTime);

  const nextReloginHours = Math.floor(nextReloginTime / (60 * 60 * 1000));
  const nextReloginMinutes = Math.floor(
    (nextReloginTime % (60 * 60 * 1000)) / (60 * 1000)
  );
  console.log(
    `🔄 Next relogin scheduled in ${nextReloginHours} hours and ${nextReloginMinutes} minutes`
  );
}

// Export for other modules to use if needed
export { browser };
