# User Stories - FieldOps Automator

## Overview

As a freelance technician, I want to automatically apply for **Granite Telecommunications** work orders on FieldNation and WorkMarket platforms so that I can maximize my job opportunities with this high-value client while maintaining control over my schedule, rates, and travel compensation.

### Input Data

- Payment (hourly rate or fixed amount)
- Date + Time (requested schedule)
- Distance (miles from location)
- Company name
- Job title
- Job description

### Output Decision

- **APPLY** - Submit application with source conditions
- **COUNTER** - Submit counter-offer with adjusted conditions (rate, time, date, travel)
- **SKIP** - Ignore the work order

---

## User Story: Granite-Only Application Mode

**As a** freelance technician  
**I want** the system to automatically apply to all Granite Telecommunications work orders and skip everything else  
**So that** I can focus exclusively on high-value Granite jobs without manual filtering

### Configuration

- Target Company: **Granite Telecommunications only**
- Minimum Hourly Rate: **$65/hour**
- All other companies: **immediately skipped**

---

### Acceptance Criteria

#### 1. Company Filtering

- [ ] System applies ONLY to jobs from "Granite Telecommunications"
- [ ] All non-Granite jobs are immediately skipped with reason "NOT_GRANITE"
- [ ] Company name matching is case-insensitive

#### 2. Working Hours Guard

- [ ] Working hours: 09:00 - 18:00 ET
- [ ] If job starts before `WORK_START_TIME` (09:00 ET) → counter with available time starting at 09:00
- [ ] If job ends after `WORK_END_TIME` (18:00 ET) → counter with time that ends by 18:00
- [ ] If full day is booked → counter with next available date and time within working hours
- [ ] Eastern Time (ET) is used for all time comparisons
- [ ] Counter-offer is ALWAYS generated for outside-hours jobs (never reject for working hours alone)

#### 3. Rate Handling

- [ ] Minimum rate: $65/hour for Granite jobs
- [ ] If offered rate < $65 and `IS_COUNTER_RATES: true` → counter with $65/hour
- [ ] If offered rate < $65 and `IS_COUNTER_RATES: false` → apply with source rate (Granite priority)
- [ ] If offered rate >= $65 → accept as-is, no rate counter
- [ ] For fixed-rate jobs: counter = `BASE_HOURLY_RATE × estLaborHours` (if `IS_COUNTER_RATES: true`)
- [ ] For fixed-rate jobs: accept source amount (if `IS_COUNTER_RATES: false`)

#### 4. Travel Expenses

- [ ] Rate: $1.25 per mile for ALL miles (`TRAVEL_RATE_PER_MILE`)
- [ ] Minimum travel expense: $30
- [ ] Always counter for travel expenses on every Granite job
- [ ] Calculation: `travelExpense = max(distance × $1.25, $30)`
- [ ] Travel expense is ADDED to counter-offer total

**Examples**:

```
Distance: 5 miles
Travel expense: 5 × $1.25 = $6.25 → minimum applies → $30.00

Distance: 30 miles
Travel expense: 30 × $1.25 = $37.50

Distance: 60 miles
Travel expense: 60 × $1.25 = $75.00
```

#### 5. Calendar Conflict Handling

- [ ] Calendar conflicts do NOT block Granite applications
- [ ] If conflict detected → counter with next available date and time slot
- [ ] System searches for free slots within working hours (09:00-18:00)
- [ ] Counter date is NEVER earlier than original requested date
- [ ] Still counter for travel and rate adjustments if needed

#### 6. Stop-Word Filtering

- [ ] System maintains stop-word lists for FieldNation and WorkMarket
- [ ] Stop-words checked against: job title, description, requirements
- [ ] Case-insensitive matching
- [ ] Matched jobs rejected with reason "STOP_WORD_MATCH" (even if Granite)

**Example Stop-Words**:

```
FieldNation: ["starlink", "satellite", "ladder over 8ft", "roof work"]
WorkMarket: ["starlink installation", "tower climb", "bucket truck"]
```

#### 7. Telegram Notifications

- [ ] Notification sent on: Application submitted
- [ ] Notification sent on: Counter-offer sent (with details)
- [ ] Notification sent on: Job rejected (with reason)
- [ ] Notification sent on: System errors
- [ ] Include order link, company, title, pay range in all notifications
- [ ] TEST_MODE notifications include "TEST:" prefix

#### 8. Test Mode Safety

- [ ] `TEST_MODE: true` blocks all real applications and counter-offers
- [ ] System still performs all checks and logging
- [ ] Telegram notifications indicate "TEST:" prefix
- [ ] Dashboard shows test decisions

#### 9. Dashboard Logging

- [ ] Dashboard accessible on port 3001
- [ ] Shows last 50 events with timestamps
- [ ] Events persisted to `logs/logs.json`
- [ ] Color-coded by status: success, warning, error, info
- [ ] Shows platform, order ID, title, decision

#### 10. Cookie Auto-Refresh

- [ ] Detect invalid/expired session by checking company name, title, payment data
- [ ] Auto-trigger relogin when session expires
- [ ] Retry failed requests after relogin
- [ ] Schedule periodic relogin every 4 hours
- [ ] Never have concurrent relogin attempts

---

## Decision Matrix

| Scenario                                      | Expected Action                         |
| --------------------------------------------- | --------------------------------------- |
| Granite, < 30mi, good rate, no conflict       | Apply directly + counter travel ($30)   |
| Granite, any distance, good rate, no conflict | Apply + counter travel                  |
| Granite, rate < $65, IS_COUNTER_RATES: true   | Counter rate to $65 + travel            |
| Granite, rate < $65, IS_COUNTER_RATES: false  | Apply with source rate + counter travel |
| Granite, outside working hours                | Counter with available time/date        |
| Granite, calendar conflict                    | Counter with available date/time        |
| Granite, stop-word match                      | Reject (no counter)                     |
| Non-Granite                                   | Skip immediately                        |

---

## Configuration Reference

```javascript
export const CONFIG = {
  // Feature Flags
  TEST_MODE: true, // Safety switch - no real actions
  FIELDNATION_ENABLED: true, // Enable FieldNation processing
  WORKMARKET_ENABLED: true, // Enable WorkMarket processing
  ONLY_GRANITE: true, // Granite-only mode (always true)
  IS_COUNTER_DATES: true, // Enable date/time counter-offers for conflicts
  IS_COUNTER_RATES: true, // Enable rate counter-offers

  // Rate Configuration
  RATES: {
    BASE_HOURLY_RATE: 65, // Granite minimum hourly rate
    BASE_HOURLY_RATE_WORKMARKET: 65, // WM-specific base rate
    BASE_HOURLY_RATE_FIELDNATION: 65, // FN-specific base rate
    MIN_PAY_THRESHOLD_WORKMARKET: 200, // WM: reject below $200
    MIN_PAY_THRESHOLD_FIELDNATION: 165, // FN: reject below $165
  },

  // Distance Settings
  DISTANCE: {
    TRAVEL_RATE_PER_MILE: 1.25, // $ per mile (all miles)
    MIN_TRAVEL_EXPENSE: 30, // Minimum travel charge
    FREE_TRAVEL_LIMIT: 0.83, // Free travel hours (50 min)
    AVERAGE_SPEED: 50, // mph for time estimates
  },

  // Time Settings (all in ET)
  TIME: {
    DEFAULT_LABOR_HOURS: 2, // Default job duration estimate
    MIN_HOURS_BETWEEN_JOBS: 1, // Buffer between jobs
    WORK_START_TIME: "09:00", // Earliest job start
    WORK_END_TIME: "18:00", // Latest job end
    BUFFER_MINUTES: 30, // Buffer around calendar events
  },

  // Telegram Settings
  TELEGRAM: {
    BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    CHAT_ID: process.env.TELEGRAM_CHAT_ID,
  },
};
```

---
