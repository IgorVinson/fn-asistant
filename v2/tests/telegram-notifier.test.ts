import assert from "node:assert/strict";
import test from "node:test";

import { formatTelegramJobAlert } from "../src/notifications/telegram/notifier.js";

test("formatTelegramJobAlert includes comparison key and counter details", () => {
  const text = formatTelegramJobAlert({
    normalized: {
      id: "wm:123",
      platform: "WorkMarket",
      platformWorkOrderId: "123",
      company: "Granite Telecommunications",
      companyNormalized: "granite telecommunications",
      title: "Test Order",
      requestedWindow: {
        earliestStart: "2026-04-10T09:00:00-04:00",
        durationHours: 4,
        timezone: "America/New_York",
        requestedDate: "2026-04-10",
        isFlexible: false
      },
      compensation: {
        payType: "hourly",
        hourlyRate: 65,
        totalBudget: 260,
        maximumPay: 260,
        estimatedHours: 4
      },
      distanceMiles: 19.6,
      sourceRef: {
        sourceKind: "manual",
        sourceId: "123",
        receivedAt: "2026-04-09T00:00:00.000Z"
      },
      tags: [],
      rawPayloadRef: "123"
    },
    decision: {
      type: "counter_both",
      reason: "OUTSIDE_WORKING_HOURS",
      trace: [],
      counterOffer: {
        hourlyRate: 65,
        travelExpense: 30,
        counterStart: "2026-04-10T09:00:00-04:00",
        counterEnd: "2026-04-10T13:00:00-04:00"
      }
    }
  });

  assert.match(text, /V2 COUNTER_BOTH \[WorkMarket:123\]/);
  assert.match(text, /Granite Telecommunications/);
  assert.match(text, /Rate: \$65\/hr/);
  assert.match(text, /Travel: \$30/);
});
