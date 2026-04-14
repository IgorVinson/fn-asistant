function nowIso() {
    return new Date().toISOString();
}
export function upsertRawEvent(db, input) {
    const timestamp = nowIso();
    db.prepare(`
      INSERT INTO raw_events (
        id, source_kind, source_id, dedupe_key, status, link, payload_json, received_at, created_at, updated_at
      ) VALUES (
        @id, @source_kind, @source_id, @dedupe_key, @status, @link, @payload_json, @received_at, @created_at, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        link = excluded.link,
        payload_json = excluded.payload_json,
        received_at = excluded.received_at,
        updated_at = excluded.updated_at
    `).run({
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
export function upsertJob(db, input) {
    const timestamp = nowIso();
    db.prepare(`
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
    `).run({
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
export function updateJobStatus(db, input) {
    db.prepare(`
      UPDATE jobs
      SET status = @status,
          updated_at = @updated_at
      WHERE id = @id
    `).run({
        id: input.id,
        status: input.status,
        updated_at: nowIso()
    });
}
export function setActivePolicySnapshot(db, input) {
    const timestamp = nowIso();
    const tx = db.transaction(() => {
        db.prepare("UPDATE policy_snapshots SET is_active = 0 WHERE is_active = 1").run();
        db.prepare(`
        INSERT INTO policy_snapshots (id, version, snapshot_json, is_active, created_at)
        VALUES (@id, @version, @snapshot_json, 1, @created_at)
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          snapshot_json = excluded.snapshot_json,
          is_active = 1
      `).run({
            id: input.id,
            version: input.policy.version,
            snapshot_json: JSON.stringify(input.policy),
            created_at: timestamp
        });
    });
    tx();
}
export function insertDecision(db, input) {
    db.prepare(`
      INSERT INTO decisions (
        id, job_id, policy_snapshot_id, decision_type, reason_code, decision_json, trace_json, calendar_provider, evaluation_context_json, created_at
      ) VALUES (
        @id, @job_id, @policy_snapshot_id, @decision_type, @reason_code, @decision_json, @trace_json, @calendar_provider, @evaluation_context_json, @created_at
      )
    `).run({
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
export function getLatestDecisionForJob(db, jobId) {
    return db
        .prepare(`
        SELECT decision_json
        FROM decisions
        WHERE job_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
        .get(jobId);
}
export function getJobInspection(db, jobId) {
    return db
        .prepare(`
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
      `)
        .get(jobId);
}
export function getLatestExecutionAttemptForJob(db, jobId) {
    return db
        .prepare(`
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
      `)
        .get(jobId);
}
export function insertExecutionAttempt(db, input) {
    const timestamp = nowIso();
    db.prepare(`
      INSERT INTO execution_attempts (
        id, job_id, decision_id, platform, action, status, attempt_number, request_payload_json, response_payload_json, error_message, result_summary, created_at, updated_at
      ) VALUES (
        @id, @job_id, @decision_id, @platform, @action, @status, @attempt_number, @request_payload_json, @response_payload_json, @error_message, @result_summary, @created_at, @updated_at
      )
    `).run({
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
export function countExecutionAttemptsForJob(db, jobId) {
    const row = db
        .prepare(`
        SELECT COUNT(*) as count
        FROM execution_attempts
        WHERE job_id = ?
      `)
        .get(jobId);
    return row.count;
}
export function hasSuccessfulExecutionAttempt(db, jobId) {
    const row = db
        .prepare(`
        SELECT 1
        FROM execution_attempts
        WHERE job_id = ?
          AND status = 'submitted'
        ORDER BY created_at DESC
        LIMIT 1
      `)
        .get(jobId);
    return Boolean(row);
}
