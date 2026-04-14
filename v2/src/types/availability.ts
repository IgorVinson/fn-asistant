export interface BusyInterval {
  start: string;
  end: string;
  label?: string;
}

export interface AvailabilityResult {
  withinWorkingHours: boolean;
  requestedSlotAvailable: boolean;
  hasSameDayCounterSlot: boolean;
  hasFutureCounterSlot: boolean;
  requestedStart: string;
  latestStart: string;
  workdayStart: string;
  workdayEnd: string;
  feasibleRequestedStart?: string;
  feasibleRequestedEnd?: string;
  counterStart?: string;
  counterEnd?: string;
  futureCounterStart?: string;
  futureCounterEnd?: string;
  detail: string;
}
