---
wave: 1
depends_on: []
files_modified:
  - utils/FieldNation/postFNCounterOffer.js
  - index.js
autonomous: true
requirements:
  - FN-COUNTER-DATE-001
  - FN-COUNTER-DATE-002
  - FN-COUNTER-DATE-003
---

# Fix FieldNation Counter Offer with Alternative Dates

## Objective
Enable FieldNation counter offers to include alternative time slots when schedule conflicts are detected, matching the existing WorkMarket functionality.

## Problem Statement
When a FieldNation work order has a schedule conflict and the system identifies an alternative time slot (COUNTER_DATES reason), the counter offer is displayed in logs and Telegram but **never actually sent to the FieldNation API**. This is because:

1. `index.js:1126` only submits counter dates for WorkMarket platform
2. `postFNCounterOffer.js` lacks date/time parameters in its function signature and request body
3. FieldNation API supports dates via `eta.start.local` and `eta.hour_estimate` (as seen in `postFNworkOrderRequest.js`)

## Tasks

### Task 1: Update postFNCounterOffer to Support Counter Dates

<read_first>
- utils/FieldNation/postFNCounterOffer.js
- utils/FieldNation/postFNworkOrderRequest.js (reference for ETA format)
</read_first>

<action>
Modify `postFNCounterOffer.js` to accept and send counter dates:

1. Add `counterDate` parameter (default `null`) to function signature after `additionalAmount`
2. When `counterDate` is provided and has a valid `start` Date object:
   - Add `eta` object to request body with:
     - `start.local`: ISO 8601 formatted date string from `counterDate.start.toISOString()`
     - `hour_estimate`: calculated from `counterDate.durationMinutes / 60` or fallback to `baseHours`
3. Update the `notes` field to mention the alternative time slot when `counterDate` is present:
   - With counterDate: "Hi! I'm interested but have a scheduling conflict. Would [formatted date/time] work instead? Thank you!"
   - Without counterDate: keep existing message about travel expenses
</action>

<acceptance_criteria>
- postFNCounterOffer.js contains `counterDate = null` parameter in function signature
- postFNCounterOffer.js contains conditional `requestBody.eta` assignment when counterDate.start is a Date
- postFNCounterOffer.js contains `eta.start.local` field with ISO string format
- postFNCounterOffer.js contains `eta.hour_estimate` field with numeric value
- postFNCounterOffer.js notes field has two variants: one mentioning alternative time, one for travel expenses
- Function maintains backward compatibility (counterDate defaults to null)
</acceptance_criteria>

### Task 2: Update index.js to Call postFNCounterOffer for COUNTER_DATES

<read_first>
- index.js (lines 1060-1177, COUNTER_DATES handling block)
- utils/FieldNation/postFNCounterOffer.js (to verify updated signature)
</read_first>

<action>
Add FieldNation counter date submission in the COUNTER_DATES handling block:

1. After the WorkMarket counter date submission block (around line 1175), add a new conditional block:
   - Check: `!CONFIG.TEST_MODE && normalizedData.platform === "FieldNation"`
   - Extract counter offer data from `eligibilityResult.counterOffer`
   - Call `postFNCounterOffer` with parameters:
     - `normalizedData.id` (workOrderId)
     - `co.baseAmount`
     - `co.travelExpense`
     - `co.payType`
     - `co.payType === "hourly" ? co.estHours : 0` (baseHours)
     - `0` (additionalHours)
     - `0` (additionalAmount)
     - `slot` (the counterDate object with start/end/durationMinutes)
   - Wrap in try/catch with error handling
   - On success: pushEvent with status "success" and message "FN counter dates submitted: [counterDateLabel]"
   - On error: pushEvent with status "error", log error, send Telegram notification, play error sound, return early
2. Ensure the new block is placed AFTER the WorkMarket block but BEFORE the final `playSound("applied")` at line 1177
</action>

<acceptance_criteria>
- index.js contains conditional check `!CONFIG.TEST_MODE && normalizedData.platform === "FieldNation"` within COUNTER_DATES block
- index.js contains `await postFNCounterOffer(` call with 8 parameters including `slot` as last parameter
- index.js contains try/catch block wrapping the FieldNation counter date submission
- index.js contains success event push with message containing "FN counter dates submitted"
- index.js contains error event push with message containing "FN counter dates failed"
- index.js contains Telegram error notification for FieldNation counter date failures
- FieldNation counter date block is positioned after WorkMarket block and before final playSound("applied")
</acceptance_criteria>

### Task 3: Verify Implementation with Manual Testing

<read_first>
- utils/FieldNation/postFNCounterOffer.js (verify changes)
- index.js (verify changes)
- config.js (to understand TEST_MODE behavior)
</read_first>

<action>
Create a test scenario to verify the fix:

1. Review the modified code to ensure:
   - postFNCounterOffer accepts counterDate parameter
   - Request body includes eta object when counterDate is present
   - index.js calls postFNCounterOffer for FieldNation COUNTER_DATES case
   - Error handling is properly implemented

2. Verify TEST_MODE behavior:
   - When CONFIG.TEST_MODE is true, no actual API calls should be made
   - Logs should show "TEST: Schedule conflict, counter slot: [slot]"

3. Check that existing functionality is preserved:
   - FieldNation counter offers for PAYMENT_INSUFFICIENT and TRAVEL_REQUIRED still work
   - WorkMarket counter dates still work as before
   - Regular applications (no counter) are unaffected
</action>

<acceptance_criteria>
- Code review confirms postFNCounterOffer signature includes counterDate parameter
- Code review confirms eta object is conditionally added to request body
- Code review confirms index.js has FieldNation-specific counter date submission
- TEST_MODE check prevents actual API calls during testing
- No syntax errors in modified files
- Existing counter offer flows (payment/travel) remain functional
</acceptance_criteria>

## Verification Criteria

The phase is complete when:
1. FieldNation counter offers with alternative dates are successfully sent to the API
2. Logs show "FN counter date submitted successfully" for COUNTER_DATES cases
3. Telegram notifications display the counter date label correctly
4. Error handling prevents crashes when API calls fail
5. TEST_MODE properly suppresses actual API calls
6. WorkMarket counter date functionality remains unchanged
7. Regular FieldNation counter offers (payment/travel) continue to work

## Must Haves

- postFNCounterOffer function accepts counterDate parameter with proper default value
- Request body includes eta.start.local and eta.hour_estimate when counterDate is provided
- index.js calls postFNCounterOffer for FieldNation platform in COUNTER_DATES block
- Error handling with try/catch, logging, Telegram notifications, and event tracking
- TEST_MODE safeguard prevents accidental API calls during testing
- Backward compatibility maintained (existing counter offers without dates still work)

## Risk Mitigation

- **Low risk**: Changes isolated to counter offer functionality
- **Pattern reuse**: Follows WorkMarket implementation pattern
- **Safety**: TEST_MODE prevents accidental API calls
- **Error handling**: Comprehensive try/catch with logging and notifications
- **Backward compatibility**: counterDate parameter defaults to null

---

*Phase: FieldNation Counter Dates Fix*
*Created: 2026-05-27*
