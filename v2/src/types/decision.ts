export type DecisionType =
  | "apply"
  | "counter_rate"
  | "counter_date"
  | "counter_both"
  | "skip"
  | "manual_review";

export type DecisionReason =
  | "ELIGIBLE"
  | "POLICY_REJECTED"
  | "PAYMENT_BELOW_MINIMUM"
  | "PAYMENT_INSUFFICIENT"
  | "TRAVEL_REQUIRED"
  | "OUTSIDE_WORKING_HOURS"
  | "SLOT_UNAVAILABLE"
  | "SESSION_UNAVAILABLE"
  | "NORMALIZATION_FAILED"
  | "NOT_IMPLEMENTED";

export interface CounterOffer {
  hourlyRate?: number;
  totalAmount?: number;
  travelExpense?: number;
  counterStart?: string;
  counterEnd?: string;
  note?: string;
}

export interface DecisionTraceStep {
  rule: string;
  matched: boolean;
  detail: string;
  values?: Record<string, string | number | boolean | null>;
}

export interface ExecutionPlan {
  action: "apply" | "counter" | "skip" | "manual_review";
  platform: "WorkMarket" | "FieldNation";
  payload: Record<string, unknown>;
}

export interface DecisionResult {
  type: DecisionType;
  reason: DecisionReason;
  trace: DecisionTraceStep[];
  counterOffer?: CounterOffer;
  executionPlan?: ExecutionPlan;
}
