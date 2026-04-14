import { defaultPolicy } from "../config/policy.js";
import { evaluateJob } from "./evaluateJob.js";
import { normalizeReplayJob } from "../platforms/normalizeReplayJob.js";
import { findReplayEntry, loadReplayEntries } from "./replayFixtures.js";
import { getLatestDecisionForJob, insertDecision, setActivePolicySnapshot, upsertJob, upsertRawEvent } from "../storage/repositories.js";
function toDecisionId(jobId) {
    return `decision:${jobId}:${Date.now()}`;
}
function persistReplayEntry(db, target, calendarProvider) {
    const policySnapshotId = `policy:${defaultPolicy.version}`;
    const rawEventId = `raw:replay:${target.job.id}`;
    const jobPrefix = target.job.platform === "FieldNation" ? "fn" : "wm";
    const jobId = `${jobPrefix}:${target.job.id}`;
    const receivedAt = new Date(target.ts ?? Date.now()).toISOString();
    upsertRawEvent(db, {
        id: rawEventId,
        sourceKind: "replay",
        sourceId: String(target.job.id),
        dedupeKey: `replay:${target.job.platform}:${target.job.id}`,
        status: "new",
        payload: target,
        receivedAt
    });
    const normalized = normalizeReplayJob(target.job, {
        sourceId: String(target.job.id),
        receivedAt
    });
    upsertJob(db, {
        id: jobId,
        platform: normalized.platform,
        status: "normalized",
        externalJobId: normalized.platformWorkOrderId,
        rawEventId,
        normalizedJob: normalized
    });
    setActivePolicySnapshot(db, {
        id: policySnapshotId,
        policy: defaultPolicy
    });
    return evaluateJob(normalized, defaultPolicy, calendarProvider).then(({ decision, evaluationContext }) => {
        insertDecision(db, {
            id: toDecisionId(jobId),
            jobId,
            policySnapshotId,
            decision,
            evaluationContext
        });
    });
}
export async function runReplaySeed(db, repoRoot, calendarProvider, platform = "WorkMarket") {
    const entries = loadReplayEntries(repoRoot);
    const target = findReplayEntry(entries, entry => entry.job.platform === platform);
    await persistReplayEntry(db, target, calendarProvider);
    const jobPrefix = target.job.platform === "FieldNation" ? "fn" : "wm";
    const jobId = `${jobPrefix}:${target.job.id}`;
    const persistedDecision = getLatestDecisionForJob(db, jobId);
    console.log("Replay seed complete");
    console.log(JSON.stringify(normalizeReplayJob(target.job, {
        sourceId: String(target.job.id),
        receivedAt: new Date(target.ts ?? Date.now()).toISOString()
    }), null, 2));
    console.log(JSON.stringify(JSON.parse(persistedDecision?.decision_json ?? "{}"), null, 2));
}
export async function runReplayJob(db, repoRoot, calendarProvider, jobId) {
    const entries = loadReplayEntries(repoRoot);
    const target = findReplayEntry(entries, entry => String(entry.job.id) === jobId);
    await persistReplayEntry(db, target, calendarProvider);
    const jobPrefix = target.job.platform === "FieldNation" ? "fn" : "wm";
    const persistedDecision = getLatestDecisionForJob(db, `${jobPrefix}:${target.job.id}`);
    console.log(`Replay job complete: ${target.job.platform} ${target.job.id}`);
    console.log(JSON.stringify(normalizeReplayJob(target.job, {
        sourceId: String(target.job.id),
        receivedAt: new Date(target.ts ?? Date.now()).toISOString()
    }), null, 2));
    console.log(JSON.stringify(JSON.parse(persistedDecision?.decision_json ?? "{}"), null, 2));
}
export async function runGraniteReplaySuite(db, repoRoot, calendarProvider) {
    const entries = loadReplayEntries(repoRoot);
    const targets = [
        findReplayEntry(entries, entry => entry.job.platform === "WorkMarket" &&
            entry.job.company === "Granite Telecommunications" &&
            entry.result?.reason === "GRANITE_ELIGIBLE"),
        findReplayEntry(entries, entry => entry.job.platform === "WorkMarket" &&
            entry.job.company === "Granite Telecommunications" &&
            entry.result?.reason === "PAYMENT_BELOW_MINIMUM"),
        findReplayEntry(entries, entry => entry.job.platform === "WorkMarket" &&
            entry.job.company === "Granite Telecommunications" &&
            entry.result?.reason === "OUTSIDE_WORKING_HOURS"),
        findReplayEntry(entries, entry => entry.job.platform === "WorkMarket" &&
            entry.job.company === "Granite Telecommunications" &&
            entry.result?.reason === "PAYMENT_INSUFFICIENT"),
        findReplayEntry(entries, entry => entry.job.platform === "WorkMarket" &&
            entry.job.company === "Granite Telecommunications" &&
            entry.result?.reason === "TRAVEL_REQUIRED")
    ];
    for (const target of targets) {
        await persistReplayEntry(db, target, calendarProvider);
        const jobPrefix = target.job.platform === "FieldNation" ? "fn" : "wm";
        const decision = getLatestDecisionForJob(db, `${jobPrefix}:${target.job.id}`);
        console.log(`Granite replay: ${target.job.id} -> ${target.result?.reason}`);
        console.log(JSON.stringify(JSON.parse(decision?.decision_json ?? "{}"), null, 2));
    }
}
