import type { NormalizedJob } from "../types/job.js";
import {
  normalizeWorkMarketReplayJob,
  type LegacyReplayJob
} from "./workmarket/normalizeReplayJob.js";
import { normalizeFieldNationReplayJob } from "./fieldnation/normalizeReplayJob.js";

export { type LegacyReplayJob } from "./workmarket/normalizeReplayJob.js";

export function normalizeReplayJob(
  job: LegacyReplayJob,
  sourceRef: {
    sourceId: string;
    link?: string;
    receivedAt: string;
  }
): NormalizedJob {
  if (job.platform === "WorkMarket") {
    return normalizeWorkMarketReplayJob(job, sourceRef);
  }

  if (job.platform === "FieldNation") {
    return normalizeFieldNationReplayJob(job, sourceRef);
  }

  throw new Error(`Unsupported replay platform: ${job.platform}`);
}
