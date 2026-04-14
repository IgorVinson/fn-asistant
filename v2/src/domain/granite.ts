import type { NormalizedJob } from "../types/job.js";

const GRANITE_COMPANY = "granite telecommunications";

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function textContainsGranite(value: string | null | undefined): boolean {
  const normalized = normalizeText(value);

  if (!normalized) {
    return false;
  }

  return normalized.includes(GRANITE_COMPANY) || /\bgranite\b/.test(normalized);
}

export function isGraniteJob(
  job: Pick<
    NormalizedJob,
    "company" | "companyNormalized" | "title" | "description" | "tags"
  >
): boolean {
  if (normalizeText(job.companyNormalized) === GRANITE_COMPANY) {
    return true;
  }

  if (normalizeText(job.company) === GRANITE_COMPANY) {
    return true;
  }

  if (job.tags.some(tag => textContainsGranite(tag))) {
    return true;
  }

  return (
    textContainsGranite(job.title) ||
    textContainsGranite(job.description)
  );
}
