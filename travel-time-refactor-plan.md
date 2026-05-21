# Plan: Time-based travel expense (replace distance-based threshold)

## Context

A real WorkMarket Granite job (order `9893467032`, 19.7mi, scheduled 6/1/2026) was **directly applied** when it should have been **countered with a ~$45 travel expense**. The user typically measures travel by time, not distance — the actual drive for this job is ~45 minutes despite being only 19.7 miles.

Four root causes:
1. **Wrong trigger**: [isEligibleForApplication.js:157](utils/isEligibleForApplication.js#L157) sets `needsTravelCounter = workOrder.distance > 20mi`. The 19.7mi job falls 0.3mi short → no counter generated.
2. **Dead config**: `CONFIG.DISTANCE.FREE_TRAVEL_LIMIT` ([config.js:26](config.js#L26)) is defined but never referenced. The user changed it to 30 expecting different behavior — nothing happened because no code reads it.
3. **Unrealistic speed estimate**: [calculateTravelMinutes() line 200-205](utils/isEligibleForApplication.js#L200-L205) uses 50 mph average — gives 23min for 19.7mi when the real drive is ~45min. This affects both availability fit and (after this change) cost.
4. **Distance-based cost formula**: [calculateCounterOffer line 352-360](utils/isEligibleForApplication.js#L352-L360) computes `distance × $1.25/mile`. Even if the trigger fired, the result would be $25 — not the $45 the user expects for a 45-minute drive.

The user explicitly confirmed: **travel alone should justify a counter** (the `TRAVEL_REQUIRED` branch at [line 566-578](utils/isEligibleForApplication.js#L566-L578) already exists — we just need to feed it correctly).

## Approach

Switch travel logic from distance-based to **time-based**, with a piecewise speed model for realistic minute estimates.

### 1. Piecewise speed estimate ([utils/isEligibleForApplication.js:200-205](utils/isEligibleForApplication.js#L200-L205))

Replace single `AVERAGE_SPEED` divisor with two regimes:
- `distance < 20mi` → use `CITY_SPEED` (default `25 mph`) — accounts for traffic, lights, residential streets
- `distance ≥ 20mi` → use `HIGHWAY_SPEED` (default `40 mph`) — mostly highway with some terminal city driving

For 19.7mi → 19.7 ÷ 25 × 60 ≈ **47 min** (matches the user's ~45min observation).
For 50mi → 50 ÷ 40 × 60 = 75 min.

### 2. Wire up `FREE_TRAVEL_LIMIT` and switch the trigger ([utils/isEligibleForApplication.js:156-158](utils/isEligibleForApplication.js#L156-L158))

In `isPaymentEligible()`:
```js
// OLD
const needsTravelCounter = workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;

// NEW
const travelMinutes = calculateTravelMinutes(workOrder);
const freeMinutes = Math.round(CONFIG.DISTANCE.FREE_TRAVEL_LIMIT * 60);
const needsTravelCounter = travelMinutes > freeMinutes;
```

The user already set `FREE_TRAVEL_LIMIT: 30/60` (30 min). After this change, that value will actually do something: any job with estimated travel > 30 min gets a travel counter.

For the example job: 47min > 30min → counter triggered.

### 3. Time-based cost in `calculateCounterOffer` ([utils/isEligibleForApplication.js:344-360](utils/isEligibleForApplication.js#L344-L360))

Replace distance-based formula with time-based:
```js
// OLD
const mileageTravel = Math.round(workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE);
if (CONFIG.FLAT_TRAVEL > 0) { ... }
else if (workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES) {
  travelExpense = mileageTravel;
}

// NEW
const travelMinutes = calculateTravelMinutes(workOrder);
const freeMinutes = Math.round(CONFIG.DISTANCE.FREE_TRAVEL_LIMIT * 60);
const timeTravel = Math.round(travelMinutes * CONFIG.DISTANCE.TRAVEL_RATE_PER_MINUTE);

if (CONFIG.FLAT_TRAVEL > 0) {
  travelExpense = Math.max(timeTravel, CONFIG.FLAT_TRAVEL);
} else if (travelMinutes > freeMinutes) {
  travelExpense = timeTravel;
}
```

Cost = full travel minutes × rate (not minutes-above-free-allowance) to match the user's "$45 for 45min" mental model. The free allowance only gates whether the charge applies, not the calculation.

### 4. Config updates ([config.js:23-29](config.js#L23-L29))

```js
DISTANCE: {
  CITY_SPEED: 25,                  // mph for distance < 20mi (city/residential)
  HIGHWAY_SPEED: 40,               // mph for distance >= 20mi (mostly highway)
  SHORT_TRIP_THRESHOLD_MILES: 20,  // miles boundary between city and highway speed
  FREE_TRAVEL_LIMIT: 30 / 60,      // free travel in hours (now actually wired up)
  TRAVEL_RATE_PER_MINUTE: 1,       // $/minute charged for travel above free limit
  // DEPRECATED — keep temporarily for the WM fallback path until removed
  TRAVEL_THRESHOLD_MILES: 20,
  TRAVEL_RATE_PER_MILE: 1.25,
  AVERAGE_SPEED: 50,
},
```

### 5. Mirror the change in the WM submitter fallback ([utils/WorkMarket/postWMCounterOffer.js:80-84](utils/WorkMarket/postWMCounterOffer.js#L80-L84))

`buildWMCounterOfferFormData` has its own fallback `distance × TRAVEL_RATE_PER_MILE` calc when no `options.travelExpense` is passed. In the normal eligibility flow this is overridden, but for safety update the fallback to use the same time-based formula (importing `calculateTravelMinutes` or inlining the calc).

## Files to modify

- [config.js](config.js) — add `CITY_SPEED`, `HIGHWAY_SPEED`, `SHORT_TRIP_THRESHOLD_MILES`, `TRAVEL_RATE_PER_MINUTE`
- [utils/isEligibleForApplication.js](utils/isEligibleForApplication.js) — `calculateTravelMinutes` (piecewise), `isPaymentEligible` (time trigger), `calculateCounterOffer` (time cost)
- [utils/WorkMarket/postWMCounterOffer.js](utils/WorkMarket/postWMCounterOffer.js) — update fallback in `buildWMCounterOfferFormData`
- [utils/telegram/telegramBot.js:218](utils/telegram/telegramBot.js#L218) — status message currently shows `$/hr` travel rate; consider showing `$/min` instead (cosmetic, non-blocking)

## Verification

1. **Unit/replay tests**: `npm test` should still pass — existing replay jobs are mostly long-distance (>20mi) where the new piecewise calc gives a slightly different but still-valid number. Spot-check the assertions; adjust expected travel values if any test pinned them to the old `$1.25/mile` formula.
2. **Targeted replay for the failing case**: Add the 19.7mi/45min Granite job (order `9893467032`) to `jobs-replay.json` if not already there, then write/extend a test in `tests/replay-policy.test.js` asserting `reason === "TRAVEL_REQUIRED"` and `counterOffer.travelExpense ≈ 47` (47 min × $1).
3. **End-to-end in TEST_MODE**: With `CONFIG.TEST_MODE = true`, use Telegram `/process <link>` to feed the order link from the alert. Verify the dashboard event shows `COUNTER_TRAVEL` (not `APPLIED`) and the travel line item is ~$47. Check the logs at `/logs/app-YYYY-MM-DD.log` for the new `Travel: ~47min, $47` breakdown.
4. **Regression spot-check**: Process 2-3 other recent Granite orders from the replay file (mixed short/long distance) to confirm previously-correct decisions still come out the same. Particularly watch for jobs that previously got `DIRECT_APPLY` with distance 5-15mi — under the new rules a 15mi/36min trip would now also counter (which is the user's desired behavior, but worth confirming).