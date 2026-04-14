function normalizeCompany(company) {
    return company.trim().toLowerCase();
}
function deriveDurationHours(job) {
    if (job.estLaborHours && job.estLaborHours > 0) {
        return job.estLaborHours;
    }
    const start = new Date(job.time.start);
    const end = new Date(job.time.end);
    const durationMs = Math.max(end.getTime() - start.getTime(), 0);
    return durationMs / (60 * 60 * 1000);
}
export function normalizeWorkMarketReplayJob(job, sourceRef) {
    if (job.platform !== "WorkMarket") {
        throw new Error(`Expected WorkMarket job, received ${job.platform}`);
    }
    const requestedStart = new Date(job.time.start);
    const requestedDate = requestedStart.toISOString().slice(0, 10);
    const durationHours = deriveDurationHours(job);
    return {
        id: `wm:${job.id}`,
        platform: "WorkMarket",
        platformWorkOrderId: String(job.id),
        company: job.company,
        companyNormalized: normalizeCompany(job.company),
        title: job.title,
        description: job.description,
        requestedWindow: {
            earliestStart: job.time.start,
            latestStart: job.time.latestStart,
            durationHours,
            timezone: "America/New_York",
            requestedDate,
            isFlexible: Boolean(job.time.latestStart)
        },
        compensation: {
            payType: job.payType ?? (job.hourlyRate ? "hourly" : "fixed"),
            hourlyRate: job.hourlyRate,
            totalBudget: job.payRange.max ?? 0,
            minimumPay: job.payRange.min,
            maximumPay: job.payRange.max,
            estimatedHours: durationHours
        },
        distanceMiles: job.distance ?? 0,
        sourceRef: {
            sourceKind: "replay",
            sourceId: sourceRef.sourceId,
            link: sourceRef.link,
            receivedAt: sourceRef.receivedAt
        },
        tags: ["replay", "workmarket"],
        rawPayloadRef: sourceRef.sourceId
    };
}
