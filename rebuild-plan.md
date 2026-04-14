# FieldOps v2 Minimal Rebuild Plan

## Summary

- Rebuild the app from scratch as one Node.js application with strict internal modules and SQLite persistence.
- Use hybrid platform access: internal authenticated HTTP endpoints for normal reads and writes, Playwright only for login/session recovery and browser-only edge flows.
- Keep v1 operationally simple: one process, one database file, one scheduler loop, one recovery loop, Telegram notifications, and a minimal admin API/CLI.
- Treat the current codebase as a reference source for fixtures, credentials, and behavior discovery only.

## Architecture

- Use a single-process modular monolith with these internal modules:
  - `sources`
  - `platform-clients`
  - `normalizers`
  - `decision-engine`
  - `availability`
  - `executor`
  - `sessions`
  - `notifications`
  - `ops`
  - `storage`
- Use SQLite as the system of record for raw events, normalized jobs, policy snapshots, decisions, execution attempts, and session metadata.
- Model work with DB statuses instead of a queue system:
  - `new`
  - `normalized`
  - `evaluated`
  - `ready_to_execute`
  - `executed`
  - `skipped`
  - `failed`
  - `needs_review`
- Make decisioning pure: input is normalized job + policy snapshot + availability result; output is decision + explanation + exact execution payload.
- Preserve flexible job windows explicitly with earliest start, latest start, and duration fields.
- Keep platform-specific operations behind thin adapters:
  - `fetchJob`
  - `submitApplication`
  - `submitCounter`
  - `ensureSession`

## Implementation Phases

- Phase 1: scaffold v2 app, TypeScript config, SQLite storage layer, structured logging, and canonical domain types.
- Phase 2: implement source adapters for Gmail and webhook ingestion with idempotent raw event persistence.
- Phase 3: implement WorkMarket and FieldNation normalization adapters with fixture-backed parsing.
- Phase 4: implement the decision engine and calculators for pay, travel, time windows, overrides, and counter generation.
- Phase 5: implement availability checking and alternate-slot selection as a dedicated service.
- Phase 6: implement platform execution adapters using internal APIs first and Playwright for login/session recovery.
- Phase 7: implement Telegram notifications plus a minimal admin API/CLI for health, jobs, traces, replay, and session refresh.
- Phase 8: run v2 in shadow mode against live inputs, compare decisions with the current app, then cut over incrementally.

## Test Plan

- Build replay-driven tests from `jobs-replay.json`.
- Add parser fixture tests for WorkMarket and FieldNation payloads/pages.
- Add pure decision tests for Granite-only filtering, pay thresholds, travel, outside-hours, requested windows, calendar conflicts, and counter behavior.
- Add execution payload tests for FieldNation and WorkMarket in `TEST_MODE`.
- Add restart and recovery tests for duplicate events, expired sessions, interrupted processing, and retry flows.

## Defaults

- Runtime: Node.js + TypeScript.
- Storage: SQLite.
- Deployment: one always-on process on one host.
- UI: defer the current React dashboard; keep Telegram plus a minimal admin API/CLI.
- Rollout: shadow mode first, then phased cutover.
