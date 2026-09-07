import assert from "node:assert/strict";
import test from "node:test";

import { CONFIG } from "../config.js";
import {
  calculateCounterOffer,
  isPaymentEligible,
} from "../utils/isEligibleForApplication.js";

function withPaymentConfig(run) {
  const snapshot = {
    enforceMinPayment: CONFIG.ENFORCE_MIN_PAYMENT,
    isCounterRates: CONFIG.IS_COUNTER_RATES,
    strategyEnabled: CONFIG.STRATEGY.ENABLED,
    fieldNationRate: CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION,
    fieldNationMinimum: CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION,
  };

  CONFIG.ENFORCE_MIN_PAYMENT = true;
  CONFIG.IS_COUNTER_RATES = true;
  CONFIG.STRATEGY.ENABLED = false;
  CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION = 60;
  CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION = 260;

  try {
    return run();
  } finally {
    CONFIG.ENFORCE_MIN_PAYMENT = snapshot.enforceMinPayment;
    CONFIG.IS_COUNTER_RATES = snapshot.isCounterRates;
    CONFIG.STRATEGY.ENABLED = snapshot.strategyEnabled;
    CONFIG.RATES.BASE_HOURLY_RATE_FIELDNATION = snapshot.fieldNationRate;
    CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION = snapshot.fieldNationMinimum;
  }
}

function makeTwoHourBlendedOrder() {
  return {
    id: 19862643,
    platform: "FieldNation",
    payType: "blended",
    payStructure: {
      type: "blended",
      base: { units: 2, amount: 80 },
      additional: { units: 6, amount: 40 },
    },
    hourlyRate: 0,
    payRange: { min: 80, max: 320 },
    estLaborHours: 2,
    distance: 4,
  };
}

test("blended eligibility uses component rates instead of max pay divided by planned hours", () => {
  withPaymentConfig(() => {
    const result = isPaymentEligible(makeTwoHourBlendedOrder());

    assert.equal(result.isAcceptable, false);
    assert.equal(result.issue, "LOW_RATE");
    assert.match(result.details, /Rate \$40\/hr is below base rate \$60\/hr/);
  });
});

test("blended counter raises the two-hour base and additional rate to the FN minimum", () => {
  withPaymentConfig(() => {
    const counter = calculateCounterOffer(makeTwoHourBlendedOrder());

    assert.equal(counter.payType, "blended");
    assert.equal(counter.counterRate, 60);
    assert.deepEqual(counter.payStructure.base, { units: 2, amount: 120 });
    assert.deepEqual(counter.payStructure.additional, { units: 6, amount: 60 });
    assert.equal(counter.baseAmount, 480);
  });
});
