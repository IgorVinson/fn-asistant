import type { BusyInterval } from "../types/availability.js";
import type { NormalizedJob } from "../types/job.js";
import type { CalendarAvailabilityProvider } from "./provider.js";

export class CompositeCalendarProvider implements CalendarAvailabilityProvider {
  readonly name: string;

  constructor(private readonly providers: CalendarAvailabilityProvider[]) {
    this.name = providers.map(provider => provider.name).join("+");
  }

  async getBusyIntervalsForJob(job: NormalizedJob): Promise<BusyInterval[]> {
    const intervalGroups = await Promise.all(
      this.providers.map(provider => provider.getBusyIntervalsForJob(job))
    );
    return intervalGroups.flat().sort((left, right) => left.start.localeCompare(right.start));
  }

  async getBusyIntervalsForDate(anchorIso: string): Promise<BusyInterval[]> {
    const intervalGroups = await Promise.all(
      this.providers.map(provider => provider.getBusyIntervalsForDate(anchorIso))
    );
    return intervalGroups.flat().sort((left, right) => left.start.localeCompare(right.start));
  }
}
