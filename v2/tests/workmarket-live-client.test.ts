import assert from "node:assert/strict";
import test from "node:test";

import {
  extractWorkMarketOrderId,
  parseLiveWorkMarketOrder
} from "../src/platforms/workmarket/liveClient.js";

test("extractWorkMarketOrderId handles direct and redirect urls", () => {
  assert.equal(
    extractWorkMarketOrderId("https://www.workmarket.com/assignments/details/7859937194"),
    "7859937194"
  );
  assert.equal(
    extractWorkMarketOrderId("https://www.workmarket.com/login?redirectTo=/assignments/details/2755467756"),
    "2755467756"
  );
});

test("parseLiveWorkMarketOrder parses requested window jobs", () => {
  const html = `
    <html>
      <head>
        <title>Fiber Extension | Priority 3 | 04/10/2026 08:00:00 - 17:00:00 EDT | Requested Window - Work Market</title>
      </head>
      <body>
        <script>
          var config = { companyName: 'Granite Telecommunications' };
        </script>
        <h2 class="assignment-header">Fiber Extension | Priority 3 | 04/10/2026 08:00:00 - 17:00:00 EDT | Requested Window</h2>
        <div>$50/hr</div>
        <div>up to 4hr</div>
        <table>
          <tr>
            <td><strong>Total budget</strong></td>
            <td><strong>$200</strong></td>
          </tr>
        </table>
        <div>(19.6 mi)</div>
      </body>
    </html>
  `;

  const parsed = parseLiveWorkMarketOrder(html, "2597819435");

  assert.equal(parsed.id, "2597819435");
  assert.equal(parsed.company, "Granite Telecommunications");
  assert.equal(parsed.hourlyRate, 50);
  assert.equal(parsed.hoursOfWork, 4);
  assert.equal(parsed.totalPayment, 200);
  assert.equal(parsed.date, "2026-04-10");
  assert.match(parsed.time, /8:00:00 AM to 5:00:00 PM EDT/);
  assert.match(parsed.latestStartTime ?? "", /5:00:00 PM EDT/);
  assert.equal(parsed.distance, 19.6);
});

test("parseLiveWorkMarketOrder rejects login pages", () => {
  assert.throws(
    () =>
      parseLiveWorkMarketOrder(
        '<html><title>Login - WorkMarket</title><a href="/login?redirectTo=/assignments/details/1">',
        "1"
      ),
    /unauthenticated/
  );
});
