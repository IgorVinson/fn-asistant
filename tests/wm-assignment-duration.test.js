import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  estimateAssignmentEnd,
  parseAssignmentDetail,
} from "../utils/WorkMarket/getWMAssignments.js";

function d(iso) {
  return new Date(iso);
}

test("WorkMarket assignment without explicit end uses default duration, not pay", () => {
  const start = d("2026-05-07T10:00:00-04:00");
  const end = estimateAssignmentEnd(start, { pay: "$225.00" });

  assert.equal(
    end.toISOString(),
    d("2026-05-07T12:00:00-04:00").toISOString()
  );
});

test("WorkMarket assignment explicit end wins over default duration", () => {
  const start = d("2026-05-07T10:00:00-04:00");
  const explicitEnd = d("2026-05-07T13:30:00-04:00");
  const end = estimateAssignmentEnd(start, {
    endDate: explicitEnd,
    pay: "$225.00",
  });

  assert.equal(end, explicitEnd);
});

test("WorkMarket assignment max hours wins when explicit end is missing", () => {
  const start = d("2026-05-07T10:00:00-04:00");
  const end = estimateAssignmentEnd(start, {
    estimatedHours: 3,
    pay: "$225.00",
  });

  assert.equal(
    end.toISOString(),
    d("2026-05-07T13:00:00-04:00").toISOString()
  );
});

test("WorkMarket assignment ignores invalid explicit end", () => {
  const start = d("2026-05-07T10:00:00-04:00");
  const end = estimateAssignmentEnd(start, {
    endDate: d("2026-05-07T09:00:00-04:00"),
    pay: "$225.00",
  });

  assert.equal(
    end.toISOString(),
    d("2026-05-07T12:00:00-04:00").toISOString()
  );
});

test("WorkMarket detail parser extracts schedule and pricing duration", () => {
  const body = fs.readFileSync("debug_response.html", "utf8");
  const detail = parseAssignmentDetail(body);

  assert.equal(detail.detailStartDate.toISOString(), new Date(1778504400000).toISOString());
  assert.equal(detail.detailEndDate, null);
  assert.equal(detail.estimatedHours, 3);
});
