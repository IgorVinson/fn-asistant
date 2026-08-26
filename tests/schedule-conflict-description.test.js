import assert from "node:assert/strict";
import test from "node:test";
import {
  describeScheduleConflict,
  getCheckedWeekdays,
} from "../utils/availability/describeScheduleConflict.js";

test("schedule conflict lists only checked weekdays across the lookahead", () => {
  const dates = getCheckedWeekdays("2026-08-28T09:00:00", 4);
  assert.deepEqual(
    dates.map(date => date.getDay()),
    [5, 1, 2]
  );
  assert.deepEqual(
    dates.map(date => date.getDate()),
    [28, 31, 1]
  );
});

test("schedule conflict explains requested time and search window", () => {
  const description = describeScheduleConflict({
    time: { start: "2026-08-28T09:00:00" },
    estLaborHours: 3,
    distance: 25,
  });

  assert.match(description, /No available schedule slot/);
  assert.match(description, /Requested: Fri, Aug 28, 9:00 AM/);
  assert.match(description, /Checked: Fri, Aug 28, Mon, Aug 31, Tue, Sep 1/);
  assert.match(description, /9:00 AM–8:00 PM/);
  assert.doesNotMatch(description, /Needed:/);
  assert.match(description, /No block long enough was found/);
});

test("schedule fetch errors are not described as calendar conflicts", () => {
  const description = describeScheduleConflict(
    {
      time: { start: "2026-08-27T09:00:00" },
      estLaborHours: 2,
      distance: 0,
    },
    { error: "Calendar API unavailable" }
  );

  assert.match(description, /Schedule check failed/);
  assert.match(description, /Reason: Calendar API unavailable/);
  assert.doesNotMatch(description, /No block long enough/);
});

test("outside-hours jobs explain that no in-hours counter slot was found", () => {
  const description = describeScheduleConflict(
    {
      time: { start: "2026-08-31T08:00:00" },
      estLaborHours: 8,
      distance: 16,
    },
    { outsideWorkingHours: true }
  );

  assert.match(description, /No in-hours counter slot available/);
  assert.match(description, /Requested: Mon, Aug 31, 8:00 AM/);
  assert.doesNotMatch(description, /Original start is outside working hours/);
  assert.doesNotMatch(description, /Needed:/);
  assert.match(description, /No block long enough was found/);
});
