import path from "node:path";
import { createRequire } from "node:module";
import { defaultPolicy } from "../config/policy.js";
import { evaluateJob } from "./evaluateJob.js";
import { insertDecision, setActivePolicySnapshot, upsertJob, upsertRawEvent } from "../storage/repositories.js";
function toDecisionId(jobId) {
    return `decision:${jobId}:${Date.now()}`;
}
const require = createRequire(import.meta.url);
function parseTimeToIso(date, time) {
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
        throw new Error(`Unable to parse time: ${time}`);
    }
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hours !== 12) {
        hours += 12;
    }
    if (period === "AM" && hours === 12) {
        hours = 0;
    }
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    return `${date}T${hh}:${mm}:00-04:00`;
}
function normalizeLiveWorkMarketJob(input) {
    const earliestStart = parseTimeToIso(input.date, input.time);
    const latestStart = input.latestStartTime
        ? parseTimeToIso(input.date, input.latestStartTime)
        : undefined;
    return {
        id: `wm:${input.id}`,
        platform: "WorkMarket",
        platformWorkOrderId: input.id,
        company: input.company,
        companyNormalized: input.company.trim().toLowerCase(),
        title: input.title,
        requestedWindow: {
            earliestStart,
            latestStart,
            durationHours: input.hoursOfWork,
            timezone: "America/New_York",
            requestedDate: input.date,
            isFlexible: Boolean(latestStart)
        },
        compensation: {
            payType: input.payType,
            hourlyRate: input.hourlyRate,
            totalBudget: input.totalPayment,
            minimumPay: input.payType === "hourly" ? input.hourlyRate : 0,
            maximumPay: input.totalPayment,
            estimatedHours: input.hoursOfWork
        },
        distanceMiles: input.distance,
        sourceRef: {
            sourceKind: "manual",
            sourceId: input.id,
            link: `https://www.workmarket.com/assignments/details/${input.id}`,
            receivedAt: new Date().toISOString()
        },
        tags: ["manual", "workmarket", "live-fetch"],
        rawPayloadRef: input.id
    };
}
export async function importLiveWorkMarketJob(db, calendarProvider, orderIdOrUrl) {
    const url = orderIdOrUrl.startsWith("http")
        ? orderIdOrUrl
        : `https://www.workmarket.com/assignments/details/${orderIdOrUrl}`;
    const originalCwd = process.cwd();
    const repoRoot = path.resolve(originalCwd, "..");
    process.chdir(repoRoot);
    let fetched;
    try {
        const { getWMorderData } = require("../../../utils/WorkMarket/getWMorderData.js");
        fetched = await getWMorderData(url);
    }
    finally {
        process.chdir(originalCwd);
    }
    if (!fetched) {
        throw new Error(`Unable to fetch WorkMarket order: ${orderIdOrUrl}`);
    }
    const normalized = normalizeLiveWorkMarketJob({
        id: String(fetched.id),
        company: fetched.company,
        title: fetched.title,
        hourlyRate: fetched.hourlyRate ?? 0,
        hoursOfWork: fetched.hoursOfWork ?? 0,
        totalPayment: fetched.totalPayment ?? 0,
        payType: fetched.payType,
        date: fetched.date,
        time: fetched.time,
        latestStartTime: fetched.latestStartTime,
        distance: fetched.distance ?? 0
    });
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
