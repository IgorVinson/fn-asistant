### Flow

~~1. Get availibles block (based on my calendar and wm internal api dashboard fetch) for WO date and next days (depends on work start, workend, config count of days)~~

~~ 2. Check is our WO fit into any availible block (by start + duration)~~

3. Apply directly or counter (with availible block)

Exact Fit: false — NO FIT
Shifted Fit: true → 5/19/2026, 2:00:00 PM — 5/19/2026, 7:00:00 PM (eff. 183min, last block — no return)

if exact fit - apply
if shifted fit counter with 1h interval for start in this case it should be 2-3 p.m
