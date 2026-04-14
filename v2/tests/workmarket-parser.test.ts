import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAssignedSummariesFromAssignmentsPage,
  parseLiveWorkMarketOrder,
  workMarketOrderToBusyInterval
} from "../src/platforms/workmarket/liveClient.js";

test("parseLiveWorkMarketOrder prefers embedded workEncoded JSON", () => {
  const html = `
    <html>
      <head><meta name="companyName" content="Granite Telecommunications"/></head>
      <body>
        <script>
          var x = {
            workEncoded: {"workNumber":"2755467756","title":"Edgeboot Cutover","schedule":{"from":1776301200000,"through":1776312000000},"pricing":{"type":"PER_HOUR","perHourPrice":75,"maxNumberOfHours":3,"maxSpendLimit":225}},
            companyName: 'Granite Telecommunications'
          };
        </script>
      </body>
    </html>
  `;

  const parsed = parseLiveWorkMarketOrder(html, "2755467756");
  assert.equal(parsed.company, "Granite Telecommunications");
  assert.equal(parsed.title, "Edgeboot Cutover");
  assert.equal(parsed.hourlyRate, 75);
  assert.equal(parsed.totalPayment, 225);
  assert.equal(parsed.payType, "hourly");
});

test("parseLiveWorkMarketOrder rejects My Work redirects", () => {
  assert.throws(
    () =>
      parseLiveWorkMarketOrder(
        '<html><title>My Work - Work Market</title><div id="assignment_list_results"></div></html>',
        "7859937194"
      ),
    /redirected to My Work/
  );
});

test("parseLiveWorkMarketOrder rejects low-confidence placeholder parse", () => {
  assert.throws(
    () =>
      parseLiveWorkMarketOrder(
        "<html><head><title>Work Market</title></head><body><div>empty</div></body></html>",
        "1312172644"
      ),
    /low-confidence/
  );
});

test("parseAssignedSummariesFromAssignmentsPage extracts assignment ids and statuses", () => {
  const html = `
    <a class="tooltipped tooltipped-n" aria-label="Cutover" href="/assignments/details/2755467756">
      <span class="title">Edgeboot Cutover</span>
    </a>
    <div class="status"><p><strong>Scheduled</strong><br/></p></div>
  `;
  const parsed = parseAssignedSummariesFromAssignmentsPage(html);
  assert.deepEqual(parsed, [
    {
      id: "2755467756",
      title: "Edgeboot Cutover",
      status: "Scheduled"
    }
  ]);
});

test("workMarketOrderToBusyInterval converts schedule text into busy interval", () => {
  const busy = workMarketOrderToBusyInterval({
    id: "1",
    company: "Granite Telecommunications",
    title: "Cutover",
    hourlyRate: 75,
    hoursOfWork: 3,
    totalPayment: 225,
    payType: "hourly",
    date: "2026-04-15",
    time: "9:00 PM to 11:00 PM EDT",
    distance: 0
  });

  assert.equal(busy?.start, "2026-04-15T21:00:00-04:00");
  assert.equal(busy?.end, "2026-04-15T23:00:00-04:00");
});
