import type Database from "better-sqlite3";

import { buildPlatformRequest } from "../execution/buildPlatformRequest.js";
import { submitPlatformRequest } from "../execution/submitPlatformRequest.js";
import { getPreferredCookiePathCandidates } from "./sessionPreference.js";
import {
  countExecutionAttemptsForJob,
  getJobInspection,
  hasSuccessfulExecutionAttempt,
  insertExecutionAttempt,
  updateJobStatus
} from "../storage/repositories.js";

function toExecutionAttemptId(jobId: string, attemptNumber: number): string {
  return `exec:${jobId}:${attemptNumber}:${Date.now()}`;
}

function summarizeExecutionResult(input: {
  dryRun: boolean;
  status: string;
  action: string;
  platform: string;
  errorMessage?: string;
}): string {
  if (input.status === "failed") {
    return `${input.platform} ${input.action} failed: ${input.errorMessage ?? "unknown error"}`;
  }

  if (input.dryRun) {
    return `${input.platform} ${input.action} recorded as dry run`;
  }

  return `${input.platform} ${input.action} submitted successfully`;
}

export function shouldBlockLiveExecution(input: {
  dryRun: boolean;
  hasSuccessfulAttempt: boolean;
}): boolean {
  return !input.dryRun && input.hasSuccessfulAttempt;
}

export async function executeJob(
  db: Database.Database,
  jobId: string,
  options?: {
    dryRun?: boolean;
  }
): Promise<void> {
  const row = getJobInspection(db, jobId);

  if (!row) {
    throw new Error(`Job not found: ${jobId}`);
  }

  if (!row.decision_json || !row.decision_id) {
    throw new Error(`No executable decision found for job: ${jobId}`);
  }

  const normalizedJob = JSON.parse(row.normalized_job_json);
  const decision = JSON.parse(row.decision_json);

  if (
    !decision.executionPlan ||
    (decision.executionPlan.action !== "apply" &&
      decision.executionPlan.action !== "counter")
  ) {
    console.log(
      JSON.stringify(
        {
          jobId,
          platform: row.platform,
          decisionType: row.decision_type,
          reasonCode: row.reason_code,
          executed: false,
          message: "Decision does not produce an apply/counter request"
        },
        null,
        2
      )
    );
    return;
  }

  const request = buildPlatformRequest(normalizedJob, decision);
  const dryRun = options?.dryRun ?? true;

  if (
    shouldBlockLiveExecution({
      dryRun,
      hasSuccessfulAttempt: hasSuccessfulExecutionAttempt(db, jobId)
    })
  ) {
    console.log(
      JSON.stringify(
        {
          jobId,
          platform: row.platform,
          decisionType: row.decision_type,
          reasonCode: row.reason_code,
          executed: false,
          blocked: true,
          message: "Live execution blocked because a submitted attempt already exists"
        },
        null,
        2
      )
    );
    return;
  }

  const attemptNumber = countExecutionAttemptsForJob(db, jobId) + 1;

  let status = dryRun ? "dry_run" : "submitted";
  let jobStatus = dryRun ? "ready_to_execute" : "executed";
  let responsePayload: unknown = {
    dryRun,
    recordedAt: new Date().toISOString()
  };
  let errorMessage: string | undefined;

  if (!dryRun) {
    try {
      responsePayload = await submitPlatformRequest(request, {
        cookiePathCandidates: getPreferredCookiePathCandidates(
          db,
          row.platform as "WorkMarket" | "FieldNation"
        )
      });
    } catch (error) {
      status = "failed";
      jobStatus = "failed";
      errorMessage =
        error instanceof Error ? error.message : String(error);
      responsePayload = {
        dryRun,
        failedAt: new Date().toISOString()
      };
    }
  }

  insertExecutionAttempt(db, {
    id: toExecutionAttemptId(jobId, attemptNumber),
    jobId,
    decisionId: row.decision_id,
    platform: row.platform,
    action: request.action,
    status,
    attemptNumber,
    requestPayload: request,
    responsePayload,
    errorMessage,
    resultSummary: summarizeExecutionResult({
      dryRun,
      status,
      action: request.action,
      platform: row.platform,
      errorMessage
    })
  });

  updateJobStatus(db, {
    id: jobId,
    status: jobStatus
  });

  console.log(
    JSON.stringify(
      {
        jobId,
        platform: row.platform,
        decisionType: row.decision_type,
        reasonCode: row.reason_code,
        executed: true,
        dryRun,
        status,
        jobStatus,
        attemptNumber,
        request,
        errorMessage
      },
      null,
      2
    )
  );
}
