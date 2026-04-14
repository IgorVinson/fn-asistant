import type { BusyInterval } from "../types/availability.js";
import type { NormalizedJob } from "../types/job.js";

export interface CalendarAvailabilityProvider {
  readonly name: string;
  getBusyIntervalsForJob(job: NormalizedJob): Promise<BusyInterval[]>;
  getBusyIntervalsForDate(anchorIso: string): Promise<BusyInterval[]>;
}
