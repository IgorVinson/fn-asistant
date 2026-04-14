import type Database from "better-sqlite3";

import type { PolicySnapshot } from "../config/policy.js";
import type { DecisionResult } from "../types/decision.js";
import type { EvaluationContext } from "../types/evaluation.js";
import type { NormalizedJob } from "../types/job.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function upsertRawEvent(
  db: Database.Database,
  input: {
    id: string;
    sourceKind: string;
    sourceId: string;
    dedupeKey: string;
    status: string;
    link?: string;
    payload: unknown;
    receivedAt: string;
  }
): void {
  const timestamp = nowIso();

  db.prepare(
    `
      INSERT INTO raw_events (
        id, source_kind, source_id, dedupe_key, status, link, payload_json, received_at, created_at, updated_at
      ) VALUES (
        @id, @source_kind, @source_id, @dedupe_key, @status, @link, @payload_json, @received_at, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        link = excluded.link,
        payload_json = excluded.payload_json,
        received_at = excluded.received_at,
        updated_at = excluded.updated_at
    `
  ).run({
    id: input.id,
    source_kind: input.sourceKind,
    source_id: input.sourceId,
    dedupe_key: input.dedupeKey,
    status: input.status,
    link: input.link ?? null,
    payload_json: JSON.stringify(input.payload),
    received_at: input.receivedAt,
    created_at: timestamp,
    updated_at: timestamp
  });
}

export function updateRawEventStatus(
  db: Database.Database,
  input: {
    id: string;
    status: string;
  }
): void {
  db.prepare(
    `
      UPDATE raw_events
      SET status = @status,
          updated_at = @updated_at
      WHERE id = @id
    `
  ).run({
    id: input.id,
    status: input.status,
    updated_at: nowIso()
  });
}

export function listPendingRawEvents(
  db: Database.Database,
  limit = 25
): Array<{
  id: string;
  source_kind: string;
  source_id: string;
  dedupe_key: string;
  status: string;
  link: string | null;
  payload_json: string;
  received_at: string;
}> {
  return db
    .prepare(
      `
        SELECT
          id,
          source_kind,
          source_id,
          dedupe_key,
          status,
          link,
          payload_json,
          received_at
        FROM raw_events
        WHERE status = 'new'
        ORDER BY received_at ASC
        LIMIT ?
      `
    )
    .all(limit) as Array<{
    id: string;
    source_kind: string;
    source_id: string;
    dedupe_key: string;
    status: string;
    link: string | null;
    payload_json: string;
    received_at: string;
  }>;
}

export function upsertJob(
  db: Database.Database,
  input: {
    id: string;
    platform: string;
    status: string;
    externalJobId?: string;
    rawEventId: string;
    normalizedJob: NormalizedJob;
  }
): void {
  const timestamp = nowIso();

  db.prepare(
    `
      INSERT INTO jobs (
        id, platform, status, external_job_id, raw_event_id, normalized_job_json, created_at, updated_at
      ) VALUES (
        @id, @platform, @status, @external_job_id, @raw_event_id, @normalized_job_json, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        external_job_id = excluded.external_job_id,
        raw_event_id = excluded.raw_event_id,
        normalized_job_json = excluded.normalized_job_json,
        updated_at = excluded.updated_at
    `
  ).run({
    id: input.id,
    platform: input.platform,
    status: input.status,
    external_job_id: input.externalJobId ?? null,
    raw_event_id: input.rawEventId,
    normalized_job_json: JSON.stringify(input.normalizedJob),
    created_at: timestamp,
    updated_at: timestamp
  });
}

export function updateJobStatus(
  db: Database.Database,
  input: {
    id: string;
    status: string;
  }
): void {
  db.prepare(
    `
      UPDATE jobs
      SET status = @status,
          updated_at = @updated_at
      WHERE id = @id
    `
  ).run({
    id: input.id,
    status: input.status,
    updated_at: nowIso()
  });
}

export function setActivePolicySnapshot(
  db: Database.Database,
  input: {
    id: string;
    policy: PolicySnapshot;
  }
): void {
  const timestamp = nowIso();

  const tx = db.transaction(() => {
    db.prepare("UPDATE policy_snapshots SET is_active = 0 WHERE is_active = 1").run();
    db.prepare(
      `
        INSERT INTO policy_snapshots (id, version, snapshot_json, is_active, created_at)
        VALUES (@id, @version, @snapshot_json, 1, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          snapshot_json = excluded.snapshot_json,
          is_active = 1
      `
    ).run({
      id: input.id,
      version: input.policy.version,
      snapshot_json: JSON.stringify(input.policy),
      created_at: timestamp
    });
  });

  tx();
}

export function insertDecision(
  db: Database.Database,
  input: {
    id: string;
    jobId: string;
    policySnapshotId: string;
    decision: DecisionResult;
    evaluationContext?: EvaluationContext;
  }
): void {
  db.prepare(
    `
      INSERT INTO decisions (
        id, job_id, policy_snapshot_id, decision_type, reason_code, decision_json, trace_json, calendar_provider, evaluation_context_json, created_at
      ) VALUES (
        @id, @job_id, @policy_snapshot_id, @decision_type, @reason_code, @decision_json, @trace_json, @calendar_provider, @evaluation_context_json, @created_at
      )
    `
  ).run({
    id: input.id,
    job_id: input.jobId,
    policy_snapshot_id: input.policySnapshotId,
    decision_type: input.decision.type,
    reason_code: input.decision.reason,
    decision_json: JSON.stringify(input.decision),
    trace_json: JSON.stringify(input.decision.trace),
    calendar_provider: input.evaluationContext?.calendarProvider ?? null,
    evaluation_context_json: input.evaluationContext
      ? JSON.stringify(input.evaluationContext)
      : null,
    created_at: nowIso()
  });
}

export function getLatestDecisionForJob(
  db: Database.Database,
  jobId: string
): { decision_json: string } | undefined {
  return db
    .prepare(
      `
        SELECT decision_json
        FROM decisions
        WHERE job_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(jobId) as { decision_json: string } | undefined;
}

export function getJobInspection(
  db: Database.Database,
  jobId: string
):
  | {
      job_id: string;
      job_status: string;
      platform: string;
      external_job_id: string | null;
      normalized_job_json: string;
      raw_event_id: string;
      raw_event_json: string;
      policy_version: string | null;
      decision_id: string | null;
      decision_type: string | null;
      reason_code: string | null;
      decision_json: string | null;
      trace_json: string | null;
      calendar_provider: string | null;
      evaluation_context_json: string | null;
      decision_created_at: string | null;
    }
    | undefined {
  return db
    .prepare(
      `
        SELECT
          jobs.id AS job_id,
          jobs.status AS job_status,
          jobs.platform AS platform,
          jobs.external_job_id AS external_job_id,
          jobs.normalized_job_json AS normalized_job_json,
          raw_events.id AS raw_event_id,
          raw_events.payload_json AS raw_event_json,
          policy_snapshots.version AS policy_version,
          decisions.id AS decision_id,
          decisions.decision_type AS decision_type,
          decisions.reason_code AS reason_code,
          decisions.decision_json AS decision_json,
          decisions.trace_json AS trace_json,
          decisions.calendar_provider AS calendar_provider,
          decisions.evaluation_context_json AS evaluation_context_json,
          decisions.created_at AS decision_created_at
        FROM jobs
        LEFT JOIN raw_events ON raw_events.id = jobs.raw_event_id
        LEFT JOIN decisions ON decisions.id = (
          SELECT d.id
          FROM decisions d
          WHERE d.job_id = jobs.id
          ORDER BY d.created_at DESC
          LIMIT 1
        )
        LEFT JOIN policy_snapshots ON policy_snapshots.id = decisions.policy_snapshot_id
        WHERE jobs.id = ?
        LIMIT 1
      `
    )
    .get(jobId) as
    | {
        job_id: string;
        job_status: string;
        platform: string;
        external_job_id: string | null;
        normalized_job_json: string;
        raw_event_id: string;
        raw_event_json: string;
        policy_version: string | null;
        decision_id: string | null;
        decision_type: string | null;
        reason_code: string | null;
        decision_json: string | null;
        trace_json: string | null;
        calendar_provider: string | null;
        evaluation_context_json: string | null;
        decision_created_at: string | null;
      }
    | undefined;
}

export function listRecentJobs(
  db: Database.Database,
  limit = 10
): Array<{
  job_id: string;
  platform: string;
  job_status: string;
  external_job_id: string | null;
  company: string | null;
  title: string | null;
  decision_type: string | null;
  reason_code: string | null;
  decision_created_at: string | null;
  latest_execution_status: string | null;
  latest_execution_created_at: string | null;
}> {
  return db
    .prepare(
      `
        SELECT
          jobs.id AS job_id,
          jobs.platform AS platform,
          jobs.status AS job_status,
          jobs.external_job_id AS external_job_id,
          json_extract(jobs.normalized_job_json, '$.company') AS company,
          json_extract(jobs.normalized_job_json, '$.title') AS title,
          decisions.decision_type AS decision_type,
          decisions.reason_code AS reason_code,
          decisions.created_at AS decision_created_at,
          execution_attempts.status AS latest_execution_status,
          execution_attempts.created_at AS latest_execution_created_at
        FROM jobs
        LEFT JOIN decisions ON decisions.id = (
          SELECT d.id
          FROM decisions d
          WHERE d.job_id = jobs.id
          ORDER BY d.created_at DESC
          LIMIT 1
        )
        LEFT JOIN execution_attempts ON execution_attempts.id = (
          SELECT ea.id
          FROM execution_attempts ea
          WHERE ea.job_id = jobs.id
          ORDER BY ea.created_at DESC
          LIMIT 1
        )
        ORDER BY jobs.updated_at DESC
        LIMIT ?
      `
    )
    .all(limit) as Array<{
    job_id: string;
    platform: string;
    job_status: string;
    external_job_id: string | null;
    company: string | null;
    title: string | null;
    decision_type: string | null;
    reason_code: string | null;
    decision_created_at: string | null;
    latest_execution_status: string | null;
    latest_execution_created_at: string | null;
  }>;
}

export function upsertSession(
  db: Database.Database,
  input: {
    id: string;
    platform: string;
    status: string;
    session: unknown;
    lastRefreshedAt?: string | null;
    expiresAt?: string | null;
  }
): void {
  const timestamp = nowIso();

  db.prepare(
    `
      INSERT INTO sessions (
        id, platform, status, session_json, last_refreshed_at, expires_at, created_at, updated_at
      ) VALUES (
        @id, @platform, @status, @session_json, @last_refreshed_at, @expires_at, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        session_json = excluded.session_json,
        last_refreshed_at = excluded.last_refreshed_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `
  ).run({
    id: input.id,
    platform: input.platform,
    status: input.status,
    session_json: JSON.stringify(input.session),
    last_refreshed_at: input.lastRefreshedAt ?? null,
    expires_at: input.expiresAt ?? null,
    created_at: timestamp,
    updated_at: timestamp
  });
}

export function listSessions(
  db: Database.Database
): Array<{
  id: string;
  platform: string;
  status: string;
  last_refreshed_at: string | null;
  expires_at: string | null;
  updated_at: string;
  session_json: string;
}> {
  return db
    .prepare(
      `
        SELECT
          id,
          platform,
          status,
          last_refreshed_at,
          expires_at,
          updated_at,
          session_json
        FROM sessions
        ORDER BY updated_at DESC
      `
    )
    .all() as Array<{
    id: string;
    platform: string;
    status: string;
    last_refreshed_at: string | null;
    expires_at: string | null;
    updated_at: string;
    session_json: string;
  }>;
}

export function getSessionByPlatform(
  db: Database.Database,
  platform: string
):
  | {
      id: string;
      platform: string;
      status: string;
      last_refreshed_at: string | null;
      expires_at: string | null;
      updated_at: string;
      session_json: string;
    }
  | undefined {
  return db
    .prepare(
      `
        SELECT
          id,
          platform,
          status,
          last_refreshed_at,
          expires_at,
          updated_at,
          session_json
        FROM sessions
        WHERE platform = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `
    )
    .get(platform) as
    | {
        id: string;
        platform: string;
        status: string;
        last_refreshed_at: string | null;
        expires_at: string | null;
        updated_at: string;
        session_json: string;
      }
    | undefined;
}

export function getAppState<T>(
  db: Database.Database,
  key: string
): T | undefined {
  const row = db
    .prepare(
      `
        SELECT value_json
        FROM app_state
        WHERE key = ?
        LIMIT 1
      `
    )
    .get(key) as { value_json: string } | undefined;

  return row ? (JSON.parse(row.value_json) as T) : undefined;
}

export function setAppState(
  db: Database.Database,
  key: string,
  value: unknown
): void {
  const timestamp = nowIso();

  db.prepare(
    `
      INSERT INTO app_state (key, value_json, updated_at)
      VALUES (@key, @value_json, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `
  ).run({
    key,
    value_json: JSON.stringify(value),
    updated_at: timestamp
  });
}

export function getLatestExecutionAttemptForJob(
  db: Database.Database,
  jobId: string
):
  | {
      id: string;
      platform: string;
      action: string;
      status: string;
      attempt_number: number;
      request_payload_json: string;
      response_payload_json: string | null;
      error_message: string | null;
      result_summary: string | null;
      created_at: string;
    }
  | undefined {
  return db
    .prepare(
      `
        SELECT
          id,
          platform,
          action,
          status,
          attempt_number,
          request_payload_json,
          response_payload_json,
          error_message,
          result_summary,
          created_at
        FROM execution_attempts
        WHERE job_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(jobId) as
    | {
        id: string;
        platform: string;
        action: string;
        status: string;
        attempt_number: number;
        request_payload_json: string;
        response_payload_json: string | null;
        error_message: string | null;
        result_summary: string | null;
        created_at: string;
      }
    | undefined;
}

export function insertExecutionAttempt(
  db: Database.Database,
  input: {
    id: string;
    jobId: string;
    decisionId: string;
    platform: string;
    action: string;
    status: string;
    attemptNumber: number;
    requestPayload: unknown;
    responsePayload?: unknown;
    errorMessage?: string;
    resultSummary?: string;
  }
): void {
  const timestamp = nowIso();

  db.prepare(
    `
      INSERT INTO execution_attempts (
        id, job_id, decision_id, platform, action, status, attempt_number, request_payload_json, response_payload_json, error_message, result_summary, created_at, updated_at
      ) VALUES (
        @id, @job_id, @decision_id, @platform, @action, @status, @attempt_number, @request_payload_json, @response_payload_json, @error_message, @result_summary, @created_at, @updated_at
      )
    `
  ).run({
    id: input.id,
    job_id: input.jobId,
    decision_id: input.decisionId,
    platform: input.platform,
    action: input.action,
    status: input.status,
    attempt_number: input.attemptNumber,
    request_payload_json: JSON.stringify(input.requestPayload),
    response_payload_json: input.responsePayload
      ? JSON.stringify(input.responsePayload)
      : null,
    error_message: input.errorMessage ?? null,
    result_summary: input.resultSummary ?? null,
    created_at: timestamp,
    updated_at: timestamp
  });
}

export function countExecutionAttemptsForJob(
  db: Database.Database,
  jobId: string
): number {
  const row = db
    .prepare(
      `
        SELECT COUNT(*) as count
        FROM execution_attempts
        WHERE job_id = ?
      `
    )
    .get(jobId) as { count: number };

  return row.count;
}

export function hasSuccessfulExecutionAttempt(
  db: Database.Database,
  jobId: string
): boolean {
  const row = db
    .prepare(
      `
        SELECT 1
        FROM execution_attempts
        WHERE job_id = ?
          AND status = 'submitted'
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(jobId);

  return Boolean(row);
}
