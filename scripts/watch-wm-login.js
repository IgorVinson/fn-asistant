/**
 * Watch the WorkMarket login happen in a visible browser.
 *
 * Runs ONLY the WM login (no monitoring loop, no FieldNation, no cookie saving),
 * and prints whatever WorkMarket shows on screen — the error banner the agent
 * normally swallows.
 *
 *   node scripts/watch-wm-login.js
 *
 * The browser stays open until you press Ctrl+C so you can inspect the page.
 */
import "dotenv/config";
import puppeteer from "puppeteer";

const email = process.env.WM_EMAIL;
const password = process.env.WM_PASSWORD;

const mask = e => (e ? e.replace(/^(.{2})[^@]*(@.*)$/, "$1***$2") : "<not set>");

console.log("Logging in as:", mask(email));
console.log("Password from .env:", password ? `set (${password.length} chars)` : "NOT SET");

if (!email || !password) {
  console.error("\n❌ WM_EMAIL / WM_PASSWORD missing from .env — nothing to test.");
  process.exit(1);
}

const browser = await puppeteer.launch({
  headless: false, // <-- visible browser
  slowMo: 60, // slow down so you can follow along
  defaultViewport: null,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
});

const page = await browser.newPage();
await page.setUserAgent(
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
);

console.log("\n📍 Opening WorkMarket login...");
await page.goto("https://www.workmarket.com/login", { waitUntil: "domcontentloaded" });

await page.waitForSelector("#login-email", { visible: true, timeout: 15000 });
console.log("👤 Typing email...");
await page.type("#login-email", email, { delay: 40 });

console.log("🔐 Typing password...");
await page.type("#login-password", password, { delay: 40 });

console.log("🔘 Clicking Login...\n");
await Promise.all([
  page.click("#login_page_button").catch(() => page.keyboard.press("Enter")),
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {}),
]);

await new Promise(r => setTimeout(r, 2500));

// This is the part the agent throws away: read what WorkMarket actually says.
const banner = await page.evaluate(() => {
  const text = document.body.innerText || "";
  const hit = [
    "Invalid Email or Password",
    "account has been locked",
    "wrong password too many times",
    "Please reset your password",
    "temporarily locked",
  ].find(m => text.toLowerCase().includes(m.toLowerCase()));
  return { hit: hit || null, url: location.href, title: document.title };
});

console.log("═".repeat(60));
console.log("Final URL :", banner.url);
console.log("Page title:", banner.title);
if (banner.hit) {
  console.log("\n⛔️ WorkMarket says:", banner.hit.toUpperCase());
  console.log("   → Login FAILED. Not a code problem — fix the account/password.");
} else if (banner.url.includes("/login")) {
  console.log("\n⚠️ Still on /login with no known banner — look at the browser window.");
} else {
  console.log("\n✅ Left the login page — login appears to have succeeded.");
  console.log("   (If a 2FA screen is showing, the code goes to the WM account's inbox.)");
}
console.log("═".repeat(60));
console.log("\n👀 Browser left open. Press Ctrl+C when you're done looking.\n");

await new Promise(() => {}); // keep open
