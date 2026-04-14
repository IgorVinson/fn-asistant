import { normalizeWorkMarketReplayJob } from "./workmarket/normalizeReplayJob.js";
import { normalizeFieldNationReplayJob } from "./fieldnation/normalizeReplayJob.js";
export function normalizeReplayJob(job, sourceRef) {
    if (job.platform === "WorkMarket") {
        return normalizeWorkMarketReplayJob(job, sourceRef);
    }
    if (job.platform === "FieldNation") {
        return normalizeFieldNationReplayJob(job, sourceRef);
    }
    throw new Error(`Unsupported replay platform: ${job.platform}`);
}
