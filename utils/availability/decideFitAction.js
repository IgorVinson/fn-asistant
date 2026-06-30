const SHIFTED_START_INTERVAL_MINUTES = 60;

// Compute the proposed counter start by mirroring the customer's requested
// clock-time onto the fitting block's calendar day, clamped so the job still
// fits the block. "Requested time if it fits, else earliest fitting time."
function mirrorRequestedStart(shiftedFit, requestedStart) {
  const block = shiftedFit.block;
  const blockStart = block.start;
  const blockEnd = block.end;
  const effMs = (shiftedFit.effectiveDurationMinutes || 0) * 60 * 1000;

  if (!(requestedStart instanceof Date) || Number.isNaN(requestedStart.getTime())) {
    return new Date(shiftedFit.start);
  }

  let start = new Date(
    blockStart.getFullYear(),
    blockStart.getMonth(),
    blockStart.getDate(),
    requestedStart.getHours(),
    requestedStart.getMinutes(),
    0,
    0
  );

  const latestStart = new Date(blockEnd.getTime() - effMs);

  // Requested time if it fits, else earliest fitting time (block start).
  // A too-early request is pulled up to the block start; a too-late request
  // (e.g. an after-hours requested time mirrored onto the counter day) also
  // falls back to the earliest fitting start rather than the latest possible
  // one, which would otherwise produce a confusing "latest-possible" slot.
  if (start.getTime() < blockStart.getTime() || start.getTime() > latestStart.getTime()) {
    start = new Date(blockStart);
  }

  return start;
}

export function decideFitAction({
  exactFit,
  shiftedFit,
  requestedStart = null,
  isRequestedWindow = false,
  requestedWindowMs = 0,
}) {
  if (exactFit?.fits) {
    return {
      action: "APPLY",
      source: "exact",
      counterDate: null,
    };
  }

  if (shiftedFit?.fits && shiftedFit.start instanceof Date) {
    const start = requestedStart
      ? mirrorRequestedStart(shiftedFit, requestedStart)
      : shiftedFit.start;

    let end;
    let durationMinutes;
    if (isRequestedWindow) {
      // Mirror the customer's requested window length onto the counter slot.
      const windowMs =
        requestedWindowMs > 0
          ? requestedWindowMs
          : SHIFTED_START_INTERVAL_MINUTES * 60 * 1000;
      end = new Date(start.getTime() + windowMs);
      durationMinutes = Math.round(windowMs / 60 / 1000);
    } else {
      // Single requested time -> propose a single exact start (no window).
      end = new Date(start);
      durationMinutes = 0;
    }

    return {
      action: "COUNTER_DATES",
      source: "shifted",
      counterDate: {
        start,
        end,
        durationMinutes,
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
