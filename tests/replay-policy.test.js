import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

import { CONFIG } from "../config.js";
import {
  evaluateApplicationPolicy,
  getWorkOrderLocalDate,
  isPaymentEligible,
  calculateCounterOffer,
} from "../utils/isEligibleForApplication.js";
import {
  isStrategyEnabled,
  isGranitePremium,
  getMinPayThreshold,
  shouldSkipAdvanceCounter,
} from "../utils/strategy/leadTimeStrategy.js";
import { buildWMCounterOfferFormData } from "../utils/WorkMarket/postWMCounterOffer.js";

// Replay data is NDJSON appended by the live app; tolerate the occasional
// malformed line (e.g. two records written without a newline separator)
// instead of failing the whole suite.
const replayEntries = fs
  .readFileSync(new URL("../jobs-replay.json", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map(line => {
    try {
      return JSON.parse(line);
    } catch {
      return null;
    }
  })
  .filter(Boolean);

function withConfig(overrides, run) {
  const snapshot = {
    APPLICATION_MODE: CONFIG.APPLICATION_MODE,
    ALLOW_ALL_COMPANIES_ON_DATES: [...CONFIG.ALLOW_ALL_COMPANIES_ON_DATES],
    ENFORCE_MIN_PAYMENT: CONFIG.ENFORCE_MIN_PAYMENT,
    STRATEGY: JSON.parse(JSON.stringify(CONFIG.STRATEGY)),
  };

  Object.assign(CONFIG, overrides);

  try {
    return run();
  } finally {
    CONFIG.APPLICATION_MODE = snapshot.APPLICATION_MODE;
    CONFIG.ALLOW_ALL_COMPANIES_ON_DATES = snapshot.ALLOW_ALL_COMPANIES_ON_DATES;
    CONFIG.ENFORCE_MIN_PAYMENT = snapshot.ENFORCE_MIN_PAYMENT;
    CONFIG.STRATEGY = snapshot.STRATEGY;
  }
}

// Build a synthetic work order whose start is `leadHours` from `now`.
function makeWorkOrder({
  company = "Acme",
  title = "Generic job",
  hourlyRate = 0,
  payType = "hourly",
  payMax,
  payMin = 0,
  estLaborHours = 2,
  leadHours = 100,
  now = Date.now(),
}) {
  const start = new Date(now + leadHours * 60 * 60 * 1000);
  return {
    platform: "FieldNation",
    company,
    title,
    payType,
    hourlyRate,
    payRange: { min: payMin, max: payMax },
    estLaborHours,
    time: { start: start.toISOString() },
  };
}

function findReplayJob(predicate) {
  const entry = replayEntries.find(item => predicate(item.job));
  assert.ok(entry, "Expected replay job fixture to exist");
  return entry.job;
}

test("granite_only allows Granite jobs by default", () => {
  const graniteJob = findReplayJob(
    job => job.company === "Granite Telecommunications"
  );

  withConfig(
    {
      APPLICATION_MODE: "granite_only",
      ALLOW_ALL_COMPANIES_ON_DATES: [],
    },
    () => {
      const result = evaluateApplicationPolicy(graniteJob);
      assert.equal(result.allowed, true);
      assert.equal(result.reason, "POLICY_ALLOWED_GRANITE");
    }
  );
});

test("granite_only rejects non-Granite jobs outside override dates", () => {
  const nonGraniteJob = findReplayJob(
    job => job.company !== "Granite Telecommunications"
  );

  withConfig(
    {
      APPLICATION_MODE: "granite_only",
      ALLOW_ALL_COMPANIES_ON_DATES: [],
    },
    () => {
      const result = evaluateApplicationPolicy(nonGraniteJob);
      assert.equal(result.allowed, false);
      assert.equal(result.reason, "POLICY_REJECTED");
    }
  );
});

test("granite_only allows non-Granite jobs on override dates", () => {
  const nonGraniteJob = findReplayJob(
    job => job.company !== "Granite Telecommunications"
  );
  const overrideDate = getWorkOrderLocalDate(nonGraniteJob);

  withConfig(
    {
      APPLICATION_MODE: "granite_only",
      ALLOW_ALL_COMPANIES_ON_DATES: [overrideDate],
    },
    () => {
      const result = evaluateApplicationPolicy(nonGraniteJob);
      assert.equal(result.allowed, true);
      assert.equal(result.reason, "POLICY_ALLOWED_DATE_OVERRIDE");
      assert.equal(result.workOrderDate, overrideDate);
    }
  );
});

test("all_companies allows non-Granite jobs without date overrides", () => {
  const nonGraniteJob = findReplayJob(
    job => job.company !== "Granite Telecommunications"
  );

  withConfig(
    {
      APPLICATION_MODE: "all_companies",
      ALLOW_ALL_COMPANIES_ON_DATES: [],
    },
    () => {
      const result = evaluateApplicationPolicy(nonGraniteJob);
      assert.equal(result.allowed, true);
      assert.equal(result.reason, "POLICY_ALLOWED_ALL_COMPANIES");
    }
  );
});

test("disabled mode blocks all jobs early", () => {
  const graniteJob = findReplayJob(
    job => job.company === "Granite Telecommunications"
  );

  withConfig(
    {
      APPLICATION_MODE: "disabled",
      ALLOW_ALL_COMPANIES_ON_DATES: [],
    },
    () => {
      const result = evaluateApplicationPolicy(graniteJob);
      assert.equal(result.allowed, false);
      assert.equal(result.reason, "MODE_DISABLED");
    }
  );
});

test("isGranitePremium detects Epik title and >=65/hr rate", () => {
  Object.assign(CONFIG.STRATEGY, {
    GRANITE_PREMIUM_MIN_RATE: 65,
    GRANITE_PREMIUM_TITLE_RE: "epik",
  });
  // Title match, even at low rate
  assert.equal(
    isGranitePremium(
      makeWorkOrder({
        company: "Granite Telecommunications",
        title: "05810092 - EPIK Install",
        hourlyRate: 50,
      })
    ),
    true
  );
  // Rate match, non-Epik title
  assert.equal(
    isGranitePremium(
      makeWorkOrder({
        company: "Granite Telecommunications",
        title: "Cabling revisit",
        hourlyRate: 65,
      })
    ),
    true
  );
  // Granite but low rate + non-Epik title -> not premium
  assert.equal(
    isGranitePremium(
      makeWorkOrder({
        company: "Granite Telecommunications",
        title: "Cabling revisit",
        hourlyRate: 50,
      })
    ),
    false
  );
  // Non-Granite, high rate -> not premium
  assert.equal(
    isGranitePremium(
      makeWorkOrder({ company: "Other Co", title: "Epik", hourlyRate: 80 })
    ),
    false
  );
});

test("getMinPayThreshold scales with lead time and exempts Granite premium", () => {
  const now = Date.now();
  const base = { company: "Acme", hourlyRate: 40 };
  // Fixed tiers so the test is independent of production config tuning.
  withConfig(
    {
      STRATEGY: {
        ...CONFIG.STRATEGY,
        GRANITE_PREMIUM_MIN_RATE: 65,
        GRANITE_PREMIUM_TITLE_RE: "epik",
        LEAD_TIME_TIERS: [
          { maxLeadHours: 36, minPay: 0 },
          { maxLeadHours: 168, minPay: 200 },
          { maxLeadHours: null, minPay: 400 },
        ],
      },
    },
    () => {
      // same-day / tomorrow (<=36h) -> 0
      assert.equal(
        getMinPayThreshold(makeWorkOrder({ ...base, leadHours: 10, now }), now),
        0
      );
      // this week (<=168h) -> 200
      assert.equal(
        getMinPayThreshold(makeWorkOrder({ ...base, leadHours: 100, now }), now),
        200
      );
      // far out (>168h) -> 400
      assert.equal(
        getMinPayThreshold(makeWorkOrder({ ...base, leadHours: 300, now }), now),
        400
      );
      // Granite premium far out -> exempt (0)
      assert.equal(
        getMinPayThreshold(
          makeWorkOrder({
            company: "Granite Telecommunications",
            title: "Epik Survey",
            hourlyRate: 65,
            leadHours: 300,
            now,
          }),
          now
        ),
        0
      );
    }
  );
});

test("shouldSkipAdvanceCounter blocks date-slippage of small jobs to a later day", () => {
  const now = Date.parse("2026-07-08T12:00:00");
  withConfig(
    {
      STRATEGY: {
        ...CONFIG.STRATEGY,
        ENABLED: true,
        GRANITE_PREMIUM_MIN_RATE: 65,
        GRANITE_PREMIUM_TITLE_RE: "epik",
        LEAD_TIME_TIERS: [
          { maxLeadHours: 36, minPay: 0 },
          { maxLeadHours: 168, minPay: 200 },
          { maxLeadHours: null, minPay: 400 },
        ],
      },
    },
    () => {
      // StrikeCheck: $100 fixed requested near-term, countered to a later day
      // (~this-week tier $200) -> should be skipped, not countered.
      const wo = {
        platform: "FieldNation",
        company: "StrikeCheck",
        title: "Express Damage Assessment",
        payType: "fixed",
        hourlyRate: 0,
        payRange: { min: 100, max: 100 },
        estLaborHours: 2,
        time: { start: new Date(now + 2 * 60 * 60 * 1000).toISOString() },
      };
      const laterDay = new Date("2026-07-10T15:00:00");
      assert.equal(shouldSkipAdvanceCounter(wo, laterDay, now), true);

      // Same-day time shift keeps the original horizon -> not skipped.
      const sameDay = new Date(now + 6 * 60 * 60 * 1000);
      assert.equal(shouldSkipAdvanceCounter(wo, sameDay, now), false);

      // A $250 job clears the later-day ($200) bar -> not skipped.
      const woBig = { ...wo, payRange: { min: 250, max: 250 } };
      assert.equal(shouldSkipAdvanceCounter(woBig, laterDay, now), false);

      // Granite-premium is exempt even when small and pushed out.
      const woGranite = {
        ...wo,
        company: "Granite Telecommunications",
        title: "EPIK Survey",
        hourlyRate: 65,
        payType: "hourly",
      };
      assert.equal(shouldSkipAdvanceCounter(woGranite, laterDay, now), false);

      // Disabled strategy -> never skips.
      CONFIG.STRATEGY.ENABLED = false;
      assert.equal(shouldSkipAdvanceCounter(wo, laterDay, now), false);
    }
  );
});

test("strategy master switch reflects config and defaults off", () => {
  assert.equal(isStrategyEnabled(), CONFIG.STRATEGY.ENABLED === true);
  withConfig({ STRATEGY: { ...CONFIG.STRATEGY, ENABLED: false } }, () => {
    assert.equal(isStrategyEnabled(), false);
  });
  withConfig({ STRATEGY: { ...CONFIG.STRATEGY, ENABLED: true } }, () => {
    assert.equal(isStrategyEnabled(), true);
  });
});

test("WorkMarket counter-offer payload includes alternate date fields", () => {
  const counterDate = {
    start: new Date("2026-04-08T13:30:00-04:00"),
    end: new Date("2026-04-08T16:30:00-04:00"),
  };

  const formData = buildWMCounterOfferFormData({
    csrfToken: "csrf123",
    hourlyRate: 65,
    hours: 3,
    distance: 42,
    options: {
      counterDate,
      payType: "fixed",
      priceType: "1",
      rescheduleOption: "window",
      isRequestedWindow: true,
      baseAmount: 195,
      note: "Requesting alternate date/time",
    },
  });

  assert.equal(formData.get("_tk"), "csrf123");
  assert.equal(formData.get("price_negotiation"), "on");
  assert.equal(formData.get("schedule_negotiation"), "on");
  assert.equal(formData.get("reschedule_option"), "window");
  assert.equal(formData.get("from"), "04/08/2026");
  assert.equal(formData.get("fromtime"), "1:30pm");
  assert.equal(formData.get("to"), "04/08/2026");
  assert.equal(formData.get("totime"), "4:30pm");
  assert.equal(formData.get("priceType"), "1");
  assert.equal(formData.get("per_hour_price"), "65");
  assert.equal(formData.get("max_number_of_hours"), "3");
  assert.equal(
    formData.get("additional_expenses"),
    String(Math.round(42 * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE))
  );
  assert.equal(formData.get("note"), "Requesting alternate date/time");
});

test("WorkMarket hourly hard-start payload can submit a slot window", () => {
  const counterDate = {
    start: new Date("2026-04-30T12:00:00-04:00"),
    end: new Date("2026-04-30T13:00:00-04:00"),
  };

  const formData = buildWMCounterOfferFormData({
    csrfToken: "csrf123",
    hourlyRate: 65,
    hours: 1,
    distance: 16.8,
    options: {
      counterDate,
      payType: "hourly",
      travelExpense: 0,
      rescheduleOption: "window",
      isRequestedWindow: true,
      note: "",
    },
  });

  assert.equal(formData.get("priceType"), "2");
  assert.equal(formData.get("reschedule_option"), "window");
  assert.equal(formData.get("from"), "04/30/2026");
  assert.equal(formData.get("fromtime"), "12:00pm");
  assert.equal(formData.get("to"), "04/30/2026");
  assert.equal(formData.get("totime"), "1:00pm");
  assert.equal(formData.get("additional_expenses"), "0");
  assert.equal(formData.get("flat_price"), "");
});

test("WorkMarket 3h @ $50 ticket is countered at $65/hr instead of rejected by Rule 1", () => {
  withConfig(
    {
      IS_COUNTER_RATES: true,
      RATES: {
        ...CONFIG.RATES,
        BASE_HOURLY_RATE_WORKMARKET: 65,
        MIN_PAY_THRESHOLD_WORKMARKET: 180,
      },
      STRATEGY: {
        ...CONFIG.STRATEGY,
        LEAD_TIME_TIERS: [
          { maxLeadHours: 36, minPay: 180 },
          { maxLeadHours: 168, minPay: 250 },
          { maxLeadHours: null, minPay: 350 },
        ],
      },
    },
    () => {
      const wmGranite3h = {
        platform: "WorkMarket",
        company: "Granite Telecommunications",
        title: "Equipment Install | Priority 3",
        payType: "hourly",
        hourlyRate: 50,
        estLaborHours: 3,
        distance: 10,
        time: { start: new Date(Date.now() + 10 * 3600 * 1000).toISOString() },
      };

      const result = isPaymentEligible(wmGranite3h);
      assert.equal(result.isAcceptable, false);
      assert.equal(result.issue, "LOW_RATE");

      const counter = calculateCounterOffer(wmGranite3h);
      assert.equal(counter.shouldCounterOffer, true);
      assert.equal(counter.counterRate, 65);
      assert.equal(counter.baseAmount, 195);
    }
  );
});

test("Low-ball short ticket (1h @ $45) is still rejected as below minimum", () => {
  withConfig(
    {
      IS_COUNTER_RATES: true,
      RATES: {
        ...CONFIG.RATES,
        BASE_HOURLY_RATE_WORKMARKET: 65,
        MIN_PAY_THRESHOLD_WORKMARKET: 180,
      },
      STRATEGY: {
        ...CONFIG.STRATEGY,
        LEAD_TIME_TIERS: [
          { maxLeadHours: 36, minPay: 180 },
          { maxLeadHours: 168, minPay: 250 },
          { maxLeadHours: null, minPay: 350 },
        ],
      },
    },
    () => {
      const wmShortJunk = {
        platform: "WorkMarket",
        company: "Tekumo",
        title: "Quick Router Reboot",
        payType: "hourly",
        hourlyRate: 45,
        estLaborHours: 1,
        distance: 10,
        time: { start: new Date(Date.now() + 10 * 3600 * 1000).toISOString() },
      };

      const result = isPaymentEligible(wmShortJunk);
      assert.equal(result.isAcceptable, false);
      assert.equal(result.issue, "BELOW_MINIMUM");
    }
  );
});

