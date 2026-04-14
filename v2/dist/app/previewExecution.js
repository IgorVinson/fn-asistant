import { buildPlatformRequest } from "../execution/buildPlatformRequest.js";
import { getJobInspection } from "../storage/repositories.js";
export function previewExecution(db, jobId) {
    const row = getJobInspection(db, jobId);
    if (!row) {
        throw new Error(`Job not found: ${jobId}`);
    }
    if (!row.decision_json) {
        throw new Error(`No decision found for job: ${jobId}`);
    }
    const normalizedJob = JSON.parse(row.normalized_job_json);
    const decision = JSON.parse(row.decision_json);
    if (!decision.executionPlan || decision.executionPlan.action !== "apply" && decision.executionPlan.action !== "counter") {
        console.log(JSON.stringify({
            jobId,
            platform: row.platform,
            decisionType: row.decision_type,
            reasonCode: row.reason_code,
            executable: false,
            message: "Decision does not produce an apply/counter request"
        }, null, 2));
        return;
    }
    const request = buildPlatformRequest(normalizedJob, decision);
    console.log(JSON.stringify({
        jobId,
        platform: row.platform,
        decisionType: row.decision_type,
        reasonCode: row.reason_code,
        request
    }, null, 2));
}
