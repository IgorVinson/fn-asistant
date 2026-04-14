import type Database from "better-sqlite3";
import fs from "node:fs";

import type { CalendarAvailabilityProvider } from "../calendar/provider.js";
import { defaultPolicy } from "../config/policy.js";
import { textContainsGranite } from "../domain/granite.js";
import { evaluateJob } from "./evaluateJob.js";
import {
  assertActiveSessionForImport,
  getPreferredCookiePathCandidates
} from "./sessionPreference.js";
import {
  insertDecision,
  setActivePolicySnapshot,
  updateRawEventStatus,
  upsertJob,
  upsertRawEvent
} from "../storage/repositories.js";
import type { NormalizedJob } from "../types/job.js";
import type { DecisionResult } from "../types/decision.js";

function toDecisionId(jobId: string): string {
  return `decision:${jobId}:${Date.now()}`;
}

function normalizeFieldNationDateTimeValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}-04:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, -5)}${trimmed.slice(-5, -2)}:${trimmed.slice(-2)}`;
  }

  return trimmed;
}

function parseFieldNationServiceWindowPoint(point: unknown): string | undefined {
  if (!point || typeof point !== "object") {
    return undefined;
  }

  const record = point as {
    local?: unknown;
    utc?: unknown;
    date?: unknown;
    time?: unknown;
  };

  if (typeof record.local === "string" && record.local.trim()) {
    return normalizeFieldNationDateTimeValue(record.local);
  }

  if (record.local && typeof record.local === "object") {
    const localRecord = record.local as { date?: unknown; time?: unknown };
    if (
      typeof localRecord.date === "string" &&
      localRecord.date.trim() &&
      typeof localRecord.time === "string" &&
      localRecord.time.trim()
    ) {
      return normalizeFieldNationDateTimeValue(
        `${localRecord.date.trim()}T${localRecord.time.trim()}`
      );
    }
  }

  if (
    typeof record.date === "string" &&
    record.date.trim() &&
    typeof record.time === "string" &&
    record.time.trim()
  ) {
    return normalizeFieldNationDateTimeValue(
      `${record.date.trim()}T${record.time.trim()}`
    );
  }

  if (typeof record.utc === "string" && record.utc.trim()) {
    return normalizeFieldNationDateTimeValue(record.utc);
  }

  return undefined;
}

function parseIsoDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`FieldNation time parse failed for value: ${value}`);
  }
  return parsed;
}

function readCookies(cookiePathCandidates: string[]): string {
  for (const filePath of cookiePathCandidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const cookiesJson = JSON.parse(fs.readFileSync(filePath, "utf8"));

    if (!Array.isArray(cookiesJson)) {
      continue;
    }

    const cookies = cookiesJson
      .filter(
        cookie =>
          typeof cookie?.name === "string" &&
          typeof cookie?.value === "string"
      )
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (cookies) {
      return cookies;
    }
  }

  throw new Error("No valid FieldNation cookies found");
}

function extractWorkOrderPayload(pageHtml: string): Record<string, unknown> {
  const match = /<script[^>]*>\s*window\.work_order\s*=\s*(.+?);\s*<\/script>/ms.exec(
    pageHtml
  );

  if (!match) {
    throw new Error("FieldNation page did not contain window.work_order");
  }

  return JSON.parse(match[1]!.trim()) as Record<string, unknown>;
}

function collectStringValues(value: unknown, depth = 0): string[] {
  if (depth > 3 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => collectStringValues(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.values(value).flatMap(item => collectStringValues(item, depth + 1));
  }

  return [];
}

function deriveFieldNationTags(workOrder: Record<string, unknown>): string[] {
  const tags = ["manual", "fieldnation", "live-fetch"];
  const graniteSignals = [
    workOrder.company,
    workOrder.title,
    workOrder.service_title,
    workOrder.description,
    workOrder.type_of_work,
    workOrder.partner,
    workOrder.role,
    workOrder.service_types,
    workOrder.service_types_legacy,
    workOrder.types_of_work
  ].flatMap(value => collectStringValues(value));

  if (graniteSignals.some(signal => textContainsGranite(signal))) {
    tags.push("granite");
  }

  return [...new Set(tags)];
}

function parseLiveFieldNationOrder(
  workOrder: Record<string, unknown>
): {
  id: string | number;
  platform: "FieldNation";
  company: string;
  title: string;
  description?: string;
  time: {
    start: string;
    end?: string;
    latestStart?: string;
  };
  payRange: {
    min?: number;
    max?: number;
  };
  payType?: "hourly" | "fixed";
  hourlyRate?: number;
  estLaborHours?: number;
  distance?: number;
  tags: string[];
} {
  if (workOrder.unavailable) {
    throw new Error(
      `FieldNation order unavailable: ${String(workOrder.error_message ?? "assigned or removed")}`
    );
  }

  const company = (workOrder.company as { name?: string } | undefined)?.name;
  const title =
    typeof workOrder.title === "string"
      ? workOrder.title
      : typeof workOrder.service_title === "string"
        ? workOrder.service_title
        : null;
  const description =
    typeof workOrder.description === "string"
      ? workOrder.description
      : undefined;
  const schedule = workOrder.schedule as
    | {
        service_window?: {
          start?: unknown;
          end?: unknown;
        };
        est_labor_hours?: number;
      }
    | undefined;
  const pay = workOrder.pay as
    | {
        type?: string;
        range?: { min?: number; max?: number };
        rate?: { pay?: number };
      }
    | undefined;
  const distance = Number(
    (workOrder.coords as { distance?: number | string } | undefined)?.distance ?? 0
  );

  const startLocal = parseFieldNationServiceWindowPoint(
    schedule?.service_window?.start
  );
  const endLocal = parseFieldNationServiceWindowPoint(
    schedule?.service_window?.end
  );

  if (
    !company ||
    !title ||
    !startLocal ||
    !pay
  ) {
    throw new Error("FieldNation order payload was missing required fields");
  }

  const payType = pay.type === "hourly" || pay.rate?.pay ? "hourly" : "fixed";
  const hourlyRate = payType === "hourly" ? Number(pay.rate?.pay ?? pay.range?.min ?? 0) : 0;
  const estLaborHours = Number(schedule?.est_labor_hours ?? 0);
  const payRange =
    pay.range && (pay.range.min || pay.range.max)
      ? {
          min: Number(pay.range.min ?? 0),
          max: Number(pay.range.max ?? pay.range.min ?? 0)
        }
      : payType === "hourly"
        ? {
            min: hourlyRate,
            max: Math.round(hourlyRate * Math.max(estLaborHours, 1))
          }
        : { min: 0, max: 0 };

  return {
    id: String(workOrder.id ?? ""),
    platform: "FieldNation",
    company,
    title,
    description,
    time: {
      start: startLocal,
      end: endLocal
    },
    payRange,
    payType,
    hourlyRate,
    estLaborHours,
    distance,
    tags: deriveFieldNationTags(workOrder)
  };
}

function normalizeLiveFieldNationJob(input: {
  id: string | number;
  company: string;
  title: string;
  description?: string;
  time: {
    start: string;
    end?: string;
    latestStart?: string;
  };
  payRange: {
    min?: number;
    max?: number;
  };
  payType?: "hourly" | "fixed";
  hourlyRate?: number;
  estLaborHours?: number;
  distance?: number;
  tags?: string[];
}): NormalizedJob {
  const earliestStart = input.time.start;
  const earliestStartDate = parseIsoDate(earliestStart);
  const requestedDate = earliestStartDate.toISOString().slice(0, 10);
  const durationHours =
    input.estLaborHours && input.estLaborHours > 0
      ? input.estLaborHours
      : input.time.end
        ? Math.max(
            (parseIsoDate(input.time.end).getTime() - earliestStartDate.getTime()) /
              (60 * 60 * 1000),
            0
          )
        : 1;

  return {
    id: `fn:${input.id}`,
    platform: "FieldNation",
    platformWorkOrderId: String(input.id),
    company: input.company,
    companyNormalized: input.company.trim().toLowerCase(),
    title: input.title,
    description: input.description,
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
    tags: input.tags ?? ["manual", "fieldnation", "live-fetch"],
    rawPayloadRef: String(input.id)
  };
}

export interface LiveImportResult {
  jobId: string;
  normalized: NormalizedJob;
  decision: DecisionResult;
}

export async function importLiveFieldNationJob(
  db: Database.Database,
  calendarProvider: CalendarAvailabilityProvider,
  orderIdOrUrl: string
): Promise<LiveImportResult> {
  assertActiveSessionForImport(db, "FieldNation");

  const url = orderIdOrUrl.startsWith("http")
    ? orderIdOrUrl
    : `https://app.fieldnation.com/workorders/${orderIdOrUrl}`;

  const cookies = readCookies(getPreferredCookiePathCandidates(db, "FieldNation"));
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      cookie: cookies,
      Referer: "https://app.fieldnation.com/workorders/"
    }
  });
  const pageHtml = await response.text();

  if (!response.ok) {
    throw new Error(`FieldNation fetch failed (${response.status})`);
  }

  const fetched = parseLiveFieldNationOrder(extractWorkOrderPayload(pageHtml));

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

  const { decision, evaluationContext } = await evaluateJob(
    normalized,
    defaultPolicy,
    calendarProvider
  );

  insertDecision(db, {
    id: toDecisionId(normalized.id),
    jobId: normalized.id,
    policySnapshotId,
    decision,
    evaluationContext
  });

  updateRawEventStatus(db, {
    id: rawEventId,
    status: "processed"
  });

  console.log(
    JSON.stringify(
      {
        imported: true,
        jobId: normalized.id,
        fetched,
        normalized,
        decision
      },
      null,
      2
    )
  );

  return {
    jobId: normalized.id,
    normalized,
    decision
  };
}
