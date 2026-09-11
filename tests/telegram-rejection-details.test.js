import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { CONFIG } from "../config.js";
import { describeAdvanceCounterRejection } from "../utils/strategy/leadTimeStrategy.js";

const order = {
  id: 19906391, platform: "FieldNation",
  company: "Intelligent Communication Solutions", title: "Printer <offline>",
  time: { start: "2026-09-08T08:45:00-04:00" },
  payRange: { min: 90, max: 180 }, hourlyRate: 90,
  payType: "hourly", estLaborHours: 2, distance: 8,
};

test("later-date rejection reports its own threshold for hourly and blended jobs", () => {
  const previous = CONFIG.STRATEGY;
  CONFIG.STRATEGY = { ...previous, LEAD_TIME_TIERS: [
    { maxLeadHours: 36, minPay: 180 },
    { maxLeadHours: 168, minPay: 250 },
    { maxLeadHours: null, minPay: 350 },
  ] };
  try {
    for (const job of [order, { ...order, id: 19906347, company: "NETFOR",
      payType: "blended", hourlyRate: 0, payRange: { min: 120, max: 220 } }]) {
      const details = describeAdvanceCounterRejection(job,
        new Date("2026-09-10T09:00:00-04:00"), Date.parse("2026-09-08T07:00:00-04:00"));
      assert.match(details, /Requested schedule unavailable/);
      assert.match(details, /Sep 10, 9:00 AM \(Eastern\)/);
      assert.match(details, /Alternative-date minimum: \$250/);
      assert.ok(details.includes(`listed maximum: $${job.payRange.max}`));
      assert.doesNotMatch(details, /minimum: \$180/);
    }
  } finally { CONFIG.STRATEGY = previous; }
});

// Exercise the actual renderer with a fake transport, without constructing the
// Telegram singleton (which starts polling and registers live commands).
function renderer(failHtml = false) {
  const source = fs.readFileSync(new URL("../utils/telegram/telegramBot.js", import.meta.url), "utf8");
  const method = source.slice(source.indexOf("  sendOrderNotification("), source.indexOf("  // Event handlers"));
  const messages = [];
  const context = vm.createContext({
    CONFIG: { TEST_MODE: true },
    describeStrategy: () => "Same-day/urgent · min $180",
    logger: { error() {} },
  });
  const bot = vm.runInContext(`new (class { ${method} })()`, context);
  bot.escapeHTML = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  bot.bot = { sendMessage: (_id, message, options) => {
    messages.push(message);
    return failHtml && options ? Promise.reject(new Error("HTML failure")) : Promise.resolve();
  } };
  return { bot, messages };
}

test("payment rejection hides original policy in HTML and plain fallback", async () => {
  const { bot, messages } = renderer(true);
  bot.sendOrderNotification(order, "❌ REJECTED",
    "Alternative: Sep 10\nAlternative-date minimum: $250 · listed maximum: $180",
    "", { showStrategy: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 2);
  for (const message of messages) {
    assert.match(message, /TEST MODE/);
    assert.match(message, /Alternative-date minimum: \$250/);
    assert.doesNotMatch(message, /Same-day\/urgent/);
  }
  assert.match(messages[0], /Printer &lt;offline&gt;/);
});

test("notifications retain strategy unless explicitly suppressed", () => {
  const { bot, messages } = renderer();
  bot.sendOrderNotification(order, "APPLY");
  assert.match(messages[0], /Same-day\/urgent/);
});
