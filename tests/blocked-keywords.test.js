import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CONFIG } from "../config.js";
import { findBlockedKeyword } from "../utils/blockedKeywords.js";
import isEligibleForApplication from "../utils/isEligibleForApplication.js";
import { parseFNWorkOrder } from "../utils/FieldNation/getFNorderData.js";
import { extractWMDescription } from "../utils/WorkMarket/getWMorderData.js";
import normalizeDateFromWO from "../utils/normalizedDateFromWO.js";

test("default blacklist matches either field with case, punctuation and HTML handling", () => {
  for (const field of ["title", "description"]) {
    for (const text of ["Install tv.", "(TV)-mount", "Install STARLINK", "Install<br>TV", "<p>Starlink</p>", "T&#86; installation"]) {
      assert.equal(findBlockedKeyword({ [field]: text }, CONFIG.BLOCKED_KEYWORDS)?.field, field, text);
    }
  }
});

test("blacklist avoids partial words, markup attributes and missing text", () => {
  for (const order of [{}, { title: null }, { title: "CCTV IPTV HDTV", description: "starlinked" }, { description: '<a href="https://starlink.com">network setup</a><script>TV</script>' }]) {
    assert.equal(findBlockedKeyword(order, CONFIG.BLOCKED_KEYWORDS), null);
  }
  assert.equal(findBlockedKeyword({ title: "TV" }, []), null);
  assert.equal(findBlockedKeyword({ title: "anything" }, ["", " ", null]), null);
  assert.equal(findBlockedKeyword({ title: "Install a+b" }, ["a+b"])?.keyword, "a+b");
});

test("TV, display and monitor jobs are blocked before applications or counters on both platforms", async () => {
  const previousMode = CONFIG.TEST_MODE;
  CONFIG.TEST_MODE = true;
  try {
    for (const platform of ["FieldNation", "WorkMarket"]) {
      for (const title of [
        "Replace Interior Digital Window Display Monitor",
        "Install TV", "Replace TVs", "Television installation", "Mount televisions",
        "Digital display replacement", "Replace displays",
        "Replace monitor", "Install monitors",
      ]) {
        // No schedule: rejection must happen before calendar/payment evaluation.
        const result = await isEligibleForApplication({ platform, title });
        assert.equal(result.eligible, false, title);
        assert.equal(result.reason, "BLOCKED_KEYWORD", title);
        assert.equal(result.counterOffer, null, title);
      }
    }
  } finally {
    CONFIG.TEST_MODE = previousMode;
  }
});

test("FieldNation structured descriptions are checked after parsing and normalization", async () => {
  const previousMode = CONFIG.TEST_MODE;
  CONFIG.TEST_MODE = true;
  try {
    for (const description of [
      { html: "<p>Replace the 49-inch monitor</p>", markdown: "Replace the monitor" },
      { markdown: "Install **TV**" },
      { text: "Install digital displays" },
      { html: "<p>Equipment visit</p>", markdown: "Replace televisions" },
    ]) {
      const parsed = parseFNWorkOrder({
        id: 20115076, title: "Equipment replacement", description,
        schedule: { service_window: { start: { local: { date: "2026-10-07", time: "10:00:00" } } } },
      });
      const normalized = normalizeDateFromWO(parsed);
      const result = await isEligibleForApplication(normalized);
      assert.equal(result.reason, "BLOCKED_KEYWORD");
      assert.equal(result.counterOffer, null);
      assert.match(result.rejectDetails, /description/);
    }
    for (const description of [null, {}, { actions: [] }, { html: "CCTV networking", markdown: "System monitoring" }]) {
      assert.equal(findBlockedKeyword({ description }, CONFIG.BLOCKED_KEYWORDS), null);
    }
  } finally {
    CONFIG.TEST_MODE = previousMode;
  }
});

test("menu board jobs are blocked before a schedule or counter is evaluated", async () => {
  const previousMode = CONFIG.TEST_MODE;
  CONFIG.TEST_MODE = true;
  try {
    for (const platform of ["FieldNation", "WorkMarket"]) {
      for (const title of [
        "2 Techs Needed - Menu Board Swap, configuration and drop off",
        "Menu Boards replacement",
        "Menu-Board repair",
        "Menu-Boards install",
      ]) {
        const result = await isEligibleForApplication({ platform, title });
        assert.equal(result.reason, "BLOCKED_KEYWORD", title);
        assert.equal(result.counterOffer, null, title);
      }
      const descriptionResult = await isEligibleForApplication({
        platform,
        title: "Network visit",
        description: "<p>Replace the menu board</p>",
      });
      assert.equal(descriptionResult.reason, "BLOCKED_KEYWORD");
      assert.equal(descriptionResult.counterOffer, null);
    }
    assert.equal(findBlockedKeyword({ title: "Menu boardroom network repair" }, CONFIG.BLOCKED_KEYWORDS), null);
  } finally {
    CONFIG.TEST_MODE = previousMode;
  }
});

test("both platforms reject before schedule evaluation and never produce a counter", async () => {
  const previousMode = CONFIG.TEST_MODE;
  CONFIG.TEST_MODE = true;
  try {
    for (const platform of ["FieldNation", "WorkMarket"]) {
      for (const field of ["title", "description"]) {
        // Missing schedule deliberately proves no calendar or payment path is reached.
        const result = await isEligibleForApplication({ platform, [field]: "Install Starlink" });
        assert.equal(result.eligible, false);
        assert.equal(result.counterOffer, null);
        assert.equal(result.reason, "BLOCKED_KEYWORD");
        assert.match(result.rejectDetails, new RegExp(field));
      }
    }
  } finally {
    CONFIG.TEST_MODE = previousMode;
  }
});

test("FN descriptions survive parsing and date normalization", () => {
  const parsed = parseFNWorkOrder({
    id: 123, description: "<p>Install Starlink</p>",
    schedule: { service_window: { start: { local: { date: "2026-10-01", time: "10:00:00" } } } },
  });
  const normalized = normalizeDateFromWO(parsed);
  assert.equal(normalized.description, "<p>Install Starlink</p>");
  assert.equal(findBlockedKeyword(normalized, CONFIG.BLOCKED_KEYWORDS)?.keyword, "starlink");
});

test("WM description extraction handles the actual fixture, HTML and embedded JSON", () => {
  const fixture = fs.readFileSync(new URL("./fixtures/wm-authenticated.html", import.meta.url), "utf8");
  assert.match(extractWMDescription(fixture), /Hopebridge Rollout Scope of Work/);
  for (const body of [
    '<textarea id="desc-text">Install&lt;br&gt;TV</textarea>',
    '<div id="description_div">Install <b>TV</b></div>',
    '<script>const page = {workEncoded: {"description":"Install TV"}};</script>',
  ]) {
    const normalized = normalizeDateFromWO({ platform: "WorkMarket", date: "2026-10-01", time: "10:00 AM", description: extractWMDescription(body) });
    assert.equal(findBlockedKeyword(normalized, CONFIG.BLOCKED_KEYWORDS)?.keyword, "TV");
  }
  assert.equal(extractWMDescription('<meta name="description" content="TV">'), "");
});
