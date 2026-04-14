import assert from "node:assert/strict";
import test from "node:test";

import { extractJobLinksFromText } from "../src/sources/gmail/poll.js";

test("extractJobLinksFromText finds WorkMarket and FieldNation links", () => {
  const results = extractJobLinksFromText(`
    https://www.workmarket.com/assignments/details/7859937194
    https://app.fieldnation.com/workorders/18899424
  `);

  assert.deepEqual(results, [
    {
      platform: "WorkMarket",
      orderId: "7859937194",
      link: "https://www.workmarket.com/assignments/details/7859937194"
    },
    {
      platform: "FieldNation",
      orderId: "18899424",
      link: "https://app.fieldnation.com/workorders/18899424"
    }
  ]);
});

test("extractJobLinksFromText prefers explicit WorkMarket Order ID over tracking links", () => {
  const results = extractJobLinksFromText(`
    Order ID: 1312172644
    http://sendgrid.workmarket.com/uni/ls/click?upn=abc
    http://sendgrid.workmarket.com/uni/ls/click?upn=def
  `);

  assert.deepEqual(results, [
    {
      platform: "WorkMarket",
      orderId: "1312172644",
      link: "https://www.workmarket.com/assignments/details/1312172644"
    }
  ]);
});
