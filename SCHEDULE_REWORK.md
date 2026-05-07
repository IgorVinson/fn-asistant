# Schedule Rework — 2026-05-07

## What changed

Replaced the scheduling logic for counter-offer time slots. The old code used hardcoded buffers and ignored travel time. The new code computes available slots from pure calendar gaps with travel time factored in.

## New files

```
utils/schedule-new/
  core.js    — 5 pure functions (no API calls, no side effects)
  index.js   — evaluateWorkOrder() + re-exports

tests/
  schedule-new.test.js — 58 tests covering all functions
```

## Core functions (`schedule-new/core.js`)

| Function | Purpose |
|---|---|
| `calculateTravelMinutes(distance)` | `<30mi → distance × 1.25`, `≥30mi → (distance / 50) × 60` |
| `mergeOverlappingBlocks(blocks)` | Merges overlapping busy blocks, keeps touching ones separate |
| `computeFreeBlocks(date, busyBlocks)` | Finds gaps between busy blocks within `09:30–18:00`, no buffer |
| `tryFitAppliedTime(wo, free, travel)` | Checks if WO fits at requested time; laborStart ≥ block.start + travel; labor must finish by requestedEnd |
| `tryFitCounterTime(wo, free, travel, opts)` | Finds any free block for counter; laborStart ≤ 15:00; ignores requested window |

## Decision flow (`schedule-new/index.js`)

```
evaluateWorkOrder(workOrder, busyBlocks, { today })
  1. checkDay(WO date)       → APPLY (today only) or COUNTER
  2. checkDay(day+1)         → COUNTER only
  3. checkDay(day+2)         → COUNTER only
  4. REJECT
```

- APPLY only when WO date = today and slot fits exactly
- COUNTER on any day, laborStart must be ≤ 15:00
- Weekends skipped, 2 future days searched
- One-way travel only (go to next order after, not home)

## Key differences from old code

| Aspect | Old | New |
|---|---|---|
| Buffer between jobs | 30 min | None (raw gaps) |
| Work day window | 9:30–17:30 | 9:30–18:00 |
| Travel in slot fitting | Ignored | One-way included |
| Counter latest start | None | 15:00 |
| Future day search | 7 days | 2 days |
| Touching busy blocks | Merged | Kept separate |

## Integration (`index.js`)

The new scheduler runs as an override after `isEligibleForApplication()`:

- **If old REJECTs but new finds COUNTER** → override to COUNTER_DATES
- **If old REJECTs but new finds APPLY** → override to ELIGIBLE
- **If old COUNTER/APPLY but new REJECTs** → override to SLOT_UNAVAILABLE

Minimal changes to existing files:
- `utils/isEligibleForApplication.js`: added `busyBlocks` field to 4 return paths
- `index.js`: ~20-line injection block + debug comparison log

## Tests

```
node --test tests/schedule-new.test.js  →  58/58 pass
node --test tests/replay-policy.test.js →   7/7 pass
```

## Running

```
npm start
```

Logs show `[SCHEDULE-COMPARE]` lines comparing old vs new for every WO. The override is active — new scheduling decisions take effect in production flow.
