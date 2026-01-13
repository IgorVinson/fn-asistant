import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { CONFIG } from "../../config/config.js";
import { loginFnAuto } from "../services/platforms/fieldnation/loginFnAuto.js";
import { authorize } from "../services/platforms/gmail/login.js";
import { loginWMAuto } from "../services/platforms/workmarket/loginWMAuto.js";

let browser;
let reloginTimeout;

export async function saveCookies(force = false) {
  try {
    const fnCookiesPath = path.resolve(process.cwd(), "src", "services", "platforms", "fieldnation", "cookies.json");
    const wmCookiesPath = path.resolve(process.cwd(), "src", "services", "platforms", "workmarket", "cookies.json");

    // Check if we actually need to refresh
    if (!force) {
      const thresholdHours = CONFIG.RELOGIN.INTERVAL_HOURS || 6;
      const thresholdMs = thresholdHours * 60 * 60 * 1000;
      const now = Date.now();

      let fnActual = false;
      let wmActual = false;
      let fnStatus = "Unknown";
      let wmStatus = "Unknown";

      if (fs.existsSync(fnCookiesPath)) {
        const stats = fs.statSync(fnCookiesPath);
        const ageMs = now - stats.mtimeMs;
        const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(2);
        if (ageMs < thresholdMs) {
          fnActual = true;
          fnStatus = `Fresh (${ageHours}h old)`;
        } else {
          fnStatus = `Stale (${ageHours}h old)`;
        }
      } else {
        fnStatus = "Missing";
      }

      if (fs.existsSync(wmCookiesPath)) {
        const stats = fs.statSync(wmCookiesPath);
        const ageMs = now - stats.mtimeMs;
        const ageHours = (ageMs / (1000 * 60 * 60)).toFixed(2);
        if (ageMs < thresholdMs) {
          wmActual = true;
          wmStatus = `Fresh (${ageHours}h old)`;
        } else {
          wmStatus = `Stale (${ageHours}h old)`;
        }
      } else {
        wmStatus = "Missing";
      }

      const fnNeeded = CONFIG.FIELDNATION_ENABLED && !fnActual;
      const wmNeeded = CONFIG.WORKMARKET_ENABLED && !wmActual;

      console.log(`📊 Cookie Status: FN: ${fnStatus}, WM: ${wmStatus}`);

      if (!fnNeeded && !wmNeeded) {
        console.log("📍 All required cookies are still fresh. Skipping login.");
        return;
      }
      
      console.log(`📍 Refresh starting because: ${fnNeeded ? 'FN needs update ' : ''}${wmNeeded ? 'WM needs update' : ''}`);
    }

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

  // We check freshness every 10-15 minutes
  const checkInterval = (10 + Math.random() * 5) * 60 * 1000;

  reloginTimeout = setTimeout(async () => {
    console.log("⏰ Periodic cookie freshness check...");
    await saveCookies(false); // Non-forced check
    scheduleRelogin();
  }, checkInterval);

  const nextCheckMinutes = Math.floor(checkInterval / (60 * 1000));
  console.log(`🔄 Next cookie freshness check in ${nextCheckMinutes} minutes`);
}

// Export for other modules to use if needed
export { browser };
