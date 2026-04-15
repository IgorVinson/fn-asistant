import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

import { CONFIG } from "../config.js";
import {
  evaluateApplicationPolicy,
  getWorkOrderLocalDate,
} from "../utils/isEligibleForApplication.js";
import { buildWMCounterOfferFormData } from "../utils/WorkMarket/postWMCounterOffer.js";

const replayEntries = fs
  .readFileSync(new URL("../jobs-replay.json", import.meta.url), "utf8")
  .trim()
  .split("\n")
  .map(line => JSON.parse(line));

function withConfig(overrides, run) {
  const snapshot = {
    APPLICATION_MODE: CONFIG.APPLICATION_MODE,
    ALLOW_ALL_COMPANIES_ON_DATES: [...CONFIG.ALLOW_ALL_COMPANIES_ON_DATES],
    ENFORCE_MIN_PAYMENT: CONFIG.ENFORCE_MIN_PAYMENT,
  };

  Object.assign(CONFIG, overrides);

  try {
    return run();
  } finally {
    CONFIG.APPLICATION_MODE = snapshot.APPLICATION_MODE;
    CONFIG.ALLOW_ALL_COMPANIES_ON_DATES = snapshot.ALLOW_ALL_COMPANIES_ON_DATES;
    CONFIG.ENFORCE_MIN_PAYMENT = snapshot.ENFORCE_MIN_PAYMENT;
  }
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
  assert.equal(formData.get("additional_expenses"), "53");
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
