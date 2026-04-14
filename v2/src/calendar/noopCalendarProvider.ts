import type { NormalizedJob } from "../types/job.js";
import type { BusyInterval } from "../types/availability.js";
import type { CalendarAvailabilityProvider } from "./provider.js";

export class NoopCalendarProvider implements CalendarAvailabilityProvider {
  readonly name = "noop";

  async getBusyIntervalsForJob(_job: NormalizedJob): Promise<BusyInterval[]> {
    return [];
  }

  async getBusyIntervalsForDate(_anchorIso: string): Promise<BusyInterval[]> {
    return [];
  }
}
