import type { BusyInterval } from "./availability.js";

export type SlotStrategy =
  | "requested_slot"
  | "same_day_counter"
  | "future_day_counter"
  | "no_slot";

export interface EvaluationContext {
  calendarProvider: string;
  evaluatedAt: string;
  busyIntervals: BusyInterval[];
  slotStrategy: SlotStrategy;
  daysShifted: number;
}
