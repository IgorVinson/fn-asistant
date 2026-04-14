import { buildFieldNationRequest } from "./buildFieldNationRequest.js";
import { buildWorkMarketRequest } from "./buildWorkMarketRequest.js";
import type { PlatformRequestSpec } from "./types.js";
import type { DecisionResult } from "../types/decision.js";
import type { NormalizedJob } from "../types/job.js";

export function buildPlatformRequest(
  job: NormalizedJob,
  decision: DecisionResult
): PlatformRequestSpec {
  if (job.platform === "WorkMarket") {
    return buildWorkMarketRequest(job, decision);
  }

  if (job.platform === "FieldNation") {
    return buildFieldNationRequest(job, decision);
  }

  throw new Error(`Unsupported platform: ${job.platform}`);
}
