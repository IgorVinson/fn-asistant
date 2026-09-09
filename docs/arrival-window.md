# Arrival window after an earlier appointment

Set `TIME.ARRIVAL_WINDOW_AFTER_JOB_MINUTES` in `config.js` to `60` or `90`;
`0` disables it. Default: `90`. Restart the agent after changing the file.

In Telegram use `/arrival` for the current value, 60/90/OFF buttons, or custom
input. `/arrival 60`, `/arrival 90`, and `/arrival 0` also work directly.
Whole minutes from 0 to 240 are supported. Changes are saved to `config.js`
before being applied in memory and take effect for new evaluations immediately,
without a restart. The value also appears in `/settings`. Installing this command
requires restarting the agent once; later setting changes do not.

After an earlier same-day busy event from Calendar, FieldNation, or WorkMarket,
the agent requests an arrival window instead of a hard start. For example, a
booking ending at 13:00 allows a 13:00–14:30 arrival proposal. Four hours of labor
must then fit through 18:30. A later requested start remains the earliest allowed
arrival; the bot does not propose arriving before the ticket's requested time.

This window replaces the estimated travel duration for that booking; travel
charges remain unchanged. The first booking of the day keeps existing behavior.
Personal calendar events also count because the current busy feeds do not reliably
distinguish work from personal appointments. An existing buyer arrival window is
kept when it accommodates the allowance; otherwise a schedule counter requires
buyer acceptance. With `IS_COUNTER_DATES: false`, required schedule counters are
skipped. This setting does not modify already submitted or assigned tickets.
