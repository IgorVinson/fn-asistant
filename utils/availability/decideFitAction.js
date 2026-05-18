const SHIFTED_START_INTERVAL_MINUTES = 60;

export function decideFitAction({ exactFit, shiftedFit }) {
  if (exactFit?.fits) {
    return {
      action: "APPLY",
      source: "exact",
      counterDate: null,
    };
  }

  if (shiftedFit?.fits && shiftedFit.start instanceof Date) {
    const start = shiftedFit.start;
    const end = new Date(
      start.getTime() + SHIFTED_START_INTERVAL_MINUTES * 60 * 1000
    );

    return {
      action: "COUNTER_DATES",
      source: "shifted",
      counterDate: {
        start,
        end,
        durationMinutes: SHIFTED_START_INTERVAL_MINUTES,
      },
    };
  }

  return {
    action: "NO_FIT",
    source: null,
    counterDate: null,
  };
}

export { SHIFTED_START_INTERVAL_MINUTES };
