export type Platform = "WorkMarket" | "FieldNation";
export type SourceKind = "gmail" | "phone_alert" | "webhook" | "manual" | "replay";

export type JobStatus =
  | "new"
  | "normalized"
  | "evaluated"
  | "ready_to_execute"
  | "executed"
  | "skipped"
  | "failed"
  | "needs_review";

export interface RequestedWindow {
  earliestStart: string;
  latestStart?: string;
  durationHours: number;
  timezone: string;
  requestedDate: string;
  isFlexible: boolean;
}

export interface Compensation {
  payType: "hourly" | "fixed";
  hourlyRate?: number;
  totalBudget: number;
  minimumPay?: number;
  maximumPay?: number;
  estimatedHours?: number;
}

export interface LocationSummary {
  address?: string;
  city?: string;
  region?: string;
  postalCode?: string;
}

export interface RawSourceRef {
  sourceKind: SourceKind;
  sourceId: string;
  link?: string;
  receivedAt: string;
  payloadHash?: string;
}

export interface NormalizedJob {
  id: string;
  platform: Platform;
  company: string;
  title: string;
  description?: string;
  requestedWindow: RequestedWindow;
  compensation: Compensation;
  distanceMiles: number;
  location?: LocationSummary;
  platformWorkOrderId?: string;
  companyNormalized: string;
  sourceRef: RawSourceRef;
  tags: string[];
  rawPayloadRef: string;
}
