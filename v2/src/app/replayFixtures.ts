import fs from "node:fs";
import path from "node:path";

import type { LegacyReplayJob } from "../platforms/normalizeReplayJob.js";

export interface ReplayEntry {
  job: LegacyReplayJob;
  result?: {
    reason?: string;
  };
  action?: string;
  ts?: number;
}

export function loadReplayEntries(repoRoot: string): ReplayEntry[] {
  return fs
    .readFileSync(path.join(repoRoot, "jobs-replay.json"), "utf8")
    .trim()
    .split("\n")
    .map(line => JSON.parse(line) as ReplayEntry);
}

export function findReplayEntry(
  entries: ReplayEntry[],
  predicate: (entry: ReplayEntry) => boolean
): ReplayEntry {
  const found = entries.find(predicate);

  if (!found) {
    throw new Error("Replay fixture not found");
  }

  return found;
}
