# Server operations

Use the Windows task `FN Assistant Manual Server`, which launches
`scripts/start-server.ps1` and the watchdog. Starting `npm run dev` directly
does not provide freeze recovery. Never run both against port 3001.
The launcher contains the watchdog and its descendants in a Windows job with
`KILL_ON_JOB_CLOSE`, so stopping the task or losing the launcher also kills its
children. A plain PowerShell/npm wrapper was observed to leave orphaned servers
on task stop, causing the replacement to fail with a port conflict.

The supervisor probes `/api/health` every 15 seconds with a five-second timeout.
After a 90-second startup grace period, three consecutive failures trigger a
restart. Responsive but stuck startup, login, or email/order processing receives
15 minutes before recovery. A deliberate `/stop` remains stopped.

`logs/watchdog.ndjson` records child PIDs, failures, last known health state,
stack capture results, exits, and restart timing. Each launch has a separate
`logs/server-console-*.log` containing stdout and stderr. These files can contain
private application data; keep them local. Health responses contain operational
state only. The inspector uses a random loopback-only port to attempt a source
stack capture on a freeze, without reading variables. Native hangs may prevent
stack capture; this is logged before restarting anyway.

The Windows task must run without an interactive login and start at boot for
unattended operation. Verify the task principal and triggers on the actual PC;
repository code alone does not configure them. Preserve a task XML backup before
changing it. `scripts/configure-server-task.ps1` applies the configuration with
administrator rights and saves its result to `logs/server-task-setup.json`.
The computer must remain powered on, online, and awake. Disable
automatic sleep on AC power; display sleep is harmless. No local watchdog can
run during power loss or Windows shutdown.

Verify `/api/health` for `startupComplete`, `monitoring`, `monitoringReady`, and
a recent `lastEmailCheckCompletedAt`. Check only selected `/api/status` fields
for LIVE/TEST mode; its full response contains credentials.

Observed October 6 failure: the Node process still owned port 3001, but HTTP
requests timed out, CPU time stayed at 12.56 seconds, and logs stopped at 10:06
AM. The exact blocked call was not captured before recovery. QuickEdit was
enabled and output went to an interactive console; console blocking is a
plausible cause, not a confirmed diagnosis. The previous task exit code was
0xC000013A. Task Scheduler history was disabled, so its initiating event was
unavailable. The new logs and stack capture support the next investigation.
