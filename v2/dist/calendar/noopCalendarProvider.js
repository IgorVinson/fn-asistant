export class NoopCalendarProvider {
    name = "noop";
    async getBusyIntervalsForJob(_job) {
        return [];
    }
    async getBusyIntervalsForDate(_anchorIso) {
        return [];
    }
}
