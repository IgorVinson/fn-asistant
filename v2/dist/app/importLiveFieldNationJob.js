import path from "node:path";
import { createRequire } from "node:module";
import { defaultPolicy } from "../config/policy.js";
import { evaluateJob } from "./evaluateJob.js";
import { insertDecision, setActivePolicySnapshot, upsertJob, upsertRawEvent } from "../storage/repositories.js";
const require = createRequire(import.meta.url);
function toDecisionId(jobId) {
    return `decision:${jobId}:${Date.now()}`;
}
function normalizeLiveFieldNationJob(input) {
    const earliestStart = input.time.start;
    const requestedDate = new Date(earliestStart).toISOString().slice(0, 10);
    const durationHours = input.estLaborHours && input.estLaborHours > 0
        ? input.estLaborHours
        : input.time.end
            ? Math.max((new Date(input.time.end).getTime() - new Date(input.time.start).getTime()) /
                (60 * 60 * 1000), 0)
            : 0;
    return {
        id: `fn:${input.id}`,
        platform: "FieldNation",
        platformWorkOrderId: String(input.id),
        company: input.company,
        companyNormalized: input.company.trim().toLowerCase(),
        title: input.title,
        requestedWindow: {
            earliestStart,
            latestStart: input.time.latestStart,
            durationHours,
            timezone: "America/New_York",
            requestedDate,
            isFlexible: Boolean(input.time.latestStart)
        },
        compensation: {
            payType: input.payType ?? (input.hourlyRate ? "hourly" : "fixed"),
            hourlyRate: input.hourlyRate,
            totalBudget: input.payRange.max ?? 0,
            minimumPay: input.payRange.min,
            maximumPay: input.payRange.max,
            estimatedHours: durationHours
        },
        distanceMiles: input.distance ?? 0,
        sourceRef: {
            sourceKind: "manual",
            sourceId: String(input.id),
            link: `https://app.fieldnation.com/workorders/${input.id}`,
            receivedAt: new Date().toISOString()
        },
        tags: ["manual", "fieldnation", "live-fetch"],
        rawPayloadRef: String(input.id)
    };
}
export async function importLiveFieldNationJob(db, calendarProvider, orderIdOrUrl) {
    const url = orderIdOrUrl.startsWith("http")
        ? orderIdOrUrl
        : `https://app.fieldnation.com/workorders/${orderIdOrUrl}`;
    const originalCwd = process.cwd();
    const repoRoot = path.resolve(originalCwd, "..");
    process.chdir(repoRoot);
    let fetched;
    try {
        const { getFNorderData } = require("../../../utils/FieldNation/getFNorderData.js");
        fetched = await getFNorderData(url);
    }
    finally {
        process.chdir(originalCwd);
    }
    if (!fetched) {
        throw new Error(`Unable to fetch FieldNation order: ${orderIdOrUrl}`);
    }
    const normalized = normalizeLiveFieldNationJob(fetched);
    const rawEventId = `raw:manual:${normalized.platformWorkOrderId}`;
    const policySnapshotId = `policy:${defaultPolicy.version}`;
    upsertRawEvent(db, {
        id: rawEventId,
        sourceKind: "manual",
        sourceId: normalized.platformWorkOrderId ?? normalized.id,
        dedupeKey: `manual:${normalized.platform}:${normalized.platformWorkOrderId ?? normalized.id}`,
        status: "new",
        link: url,
        payload: fetched,
        receivedAt: normalized.sourceRef.receivedAt
    });
    upsertJob(db, {
        id: normalized.id,
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
    const { decision, evaluationContext } = await evaluateJob(normalized, defaultPolicy, calendarProvider);
    insertDecision(db, {
        id: toDecisionId(normalized.id),
        jobId: normalized.id,
        policySnapshotId,
        decision,
        evaluationContext
    });
    console.log(JSON.stringify({
        imported: true,
        jobId: normalized.id,
        fetched,
        normalized,
        decision
    }, null, 2));
}
