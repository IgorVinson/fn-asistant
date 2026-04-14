import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

import { authorize } from "../src/copied/gmail/login.ts";
import { loginWMAuto } from "../src/copied/workmarket/loginWMAuto.ts";
import { loginFnAuto } from "../src/copied/fieldnation/loginFnAuto.ts";

const target = process.argv[2];

if (!["WorkMarket", "FieldNation"].includes(target)) {
  console.error("Usage: node refreshLegacySession.mjs <WorkMarket|FieldNation>");
  process.exit(1);
}

const browser = await puppeteer.launch({
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
    "--enable-experimental-web-platform-features",
    "--enable-blink-features=ShadowDOMV0",
    "--force-device-scale-factor=1",
    "--disable-extensions-except",
    "--disable-plugins-discovery",
    "--incognito"
  ]
});

try {
  const gmailAuth = await authorize();

  if (target === "WorkMarket") {
    const result = await loginWMAuto(
      browser,
      undefined,
      undefined,
      null,
      false,
      gmailAuth
    );
    const cookiePath = path.resolve(process.cwd(), "data", "sessions", "workmarket-cookies.json");
    const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));

    console.log(
      JSON.stringify({
        platform: "WorkMarket",
        success: result.success,
        cookiePath,
        cookieCount: Array.isArray(cookies) ? cookies.length : 0,
        message: result.message ?? null,
        error: result.error ?? null
      })
    );
  } else {
    const result = await loginFnAuto(
      browser,
      undefined,
      undefined,
      null,
      false,
      gmailAuth
    );
    const cookiePath = path.resolve(process.cwd(), "data", "sessions", "fieldnation-cookies.json");
    const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf8"));

    console.log(
      JSON.stringify({
        platform: "FieldNation",
        success: result.success,
        cookiePath,
        cookieCount: Array.isArray(cookies) ? cookies.length : 0,
        message: result.message ?? null,
        error: result.error ?? null
      })
    );
  }
} finally {
  await browser.close();
}
