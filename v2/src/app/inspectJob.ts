import type Database from "better-sqlite3";

import {
  getJobInspection,
  getLatestExecutionAttemptForJob
} from "../storage/repositories.js";

export function inspectJob(db: Database.Database, jobId: string): void {
  const row = getJobInspection(db, jobId);

  if (!row) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const normalizedJob = JSON.parse(row.normalized_job_json);
  const rawEvent = JSON.parse(row.raw_event_json);
  const decision = row.decision_json ? JSON.parse(row.decision_json) : null;
  const trace = row.trace_json ? JSON.parse(row.trace_json) : null;
  const evaluationContext = row.evaluation_context_json
    ? JSON.parse(row.evaluation_context_json)
    : null;
  const latestExecutionAttempt = getLatestExecutionAttemptForJob(db, jobId);
  const executionAttempt = latestExecutionAttempt
    ? {
        id: latestExecutionAttempt.id,
        platform: latestExecutionAttempt.platform,
        action: latestExecutionAttempt.action,
        status: latestExecutionAttempt.status,
        attemptNumber: latestExecutionAttempt.attempt_number,
        resultSummary: latestExecutionAttempt.result_summary,
        requestPayload: JSON.parse(latestExecutionAttempt.request_payload_json),
        responsePayload: latestExecutionAttempt.response_payload_json
          ? JSON.parse(latestExecutionAttempt.response_payload_json)
          : null,
        errorMessage: latestExecutionAttempt.error_message,
        createdAt: latestExecutionAttempt.created_at
      }
    : null;

  console.log(
    JSON.stringify(
      {
        jobId: row.job_id,
        platform: row.platform,
        jobStatus: row.job_status,
        externalJobId: row.external_job_id,
        policyVersion: row.policy_version,
        decisionType: row.decision_type,
        reasonCode: row.reason_code,
        decisionCreatedAt: row.decision_created_at,
        calendarProvider: row.calendar_provider,
        evaluationContext,
        executionAttempt,
        normalizedJob,
        decision,
        trace,
        rawEvent
      },
      null,
      2
    )
  );
}
