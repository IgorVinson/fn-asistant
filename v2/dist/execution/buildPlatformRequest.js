import { buildFieldNationRequest } from "./buildFieldNationRequest.js";
import { buildWorkMarketRequest } from "./buildWorkMarketRequest.js";
export function buildPlatformRequest(job, decision) {
    if (job.platform === "WorkMarket") {
        return buildWorkMarketRequest(job, decision);
    }
    if (job.platform === "FieldNation") {
        return buildFieldNationRequest(job, decision);
    }
    throw new Error(`Unsupported platform: ${job.platform}`);
}
