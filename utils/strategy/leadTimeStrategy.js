import { CONFIG } from "../../config.js";

// Lead-time booking strategy. Every function here is pure (no network/calendar)
// and gated behind CONFIG.STRATEGY.ENABLED so the whole feature can be turned
// off with a single flag, reverting the agent to its previous single-threshold
// behavior. isEligibleForApplication.js only delegates here when the strategy
// is enabled.

export function isStrategyEnabled() {
  return CONFIG.STRATEGY?.ENABLED === true;
}

export function formatLeadTimePolicy() {
  const tiers = CONFIG.STRATEGY?.LEAD_TIME_TIERS || [];
  const sameDay = tiers[0]?.minPay ?? 0;
  const mid = tiers[1]?.minPay ?? 0;
  const advance = tiers[2]?.minPay ?? 0;

  return [
    `⚡ Same day / urgent (≤36h): $${sameDay}`,
    `📆 Mid-range (36h–7 days): $${mid}`,
    `🗓️ 7+ days: $${advance}`,
  ].join("\n");
}

function isGraniteCompany(companyName) {
  return (companyName || "").trim().toLowerCase() === "granite telecommunications";
}

// Buyer's offered hourly rate as seen by the payment logic.
function getWorkOrderRate(workOrder) {
  return workOrder.hourlyRate || workOrder.payRange?.min || 0;
}

// Buyer's offered total pay, mirroring isPaymentEligible's calculation.
export function getWorkOrderTotalPay(workOrder) {
  const estHours = workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const isHourly = workOrder.payType === "hourly" || workOrder.hourlyRate > 0;
  if (isHourly) {
    const rate = getWorkOrderRate(workOrder);
    return workOrder.payRange?.max || rate * estHours;
  }
  return workOrder.payRange?.max || 0;
}

// Granite "premium" tickets: hourly rate at/above the configured floor OR the
// title matches the configured pattern (e.g. "epik"). These are the best jobs
// (survey/install, often 5+ hours) and are worth booking in advance, so they
// bypass the lead-time thresholds entirely.
export function isGranitePremium(workOrder) {
  if (!isGraniteCompany(workOrder.company)) return false;
  const strat = CONFIG.STRATEGY || {};
  const rate = getWorkOrderRate(workOrder);
  if (rate >= (strat.GRANITE_PREMIUM_MIN_RATE ?? Infinity)) return true;
  const pattern = strat.GRANITE_PREMIUM_TITLE_RE;
  if (pattern && new RegExp(pattern, "i").test(workOrder.title || "")) return true;

  // When counter rates is active, Granite orders of 3+ hours (e.g. 3h @ $50/hr)
  // will be countered at our base rate ($65/hr = $195+), qualifying as Granite priority.
  if (CONFIG.IS_COUNTER_RATES) {
    const estHours =
      workOrder.estLaborHours || CONFIG.TIME?.DEFAULT_LABOR_HOURS || 2;
    if (estHours >= 3) return true;
  }

  return false;
}

// Hours from now until the work order's start. Negative when already started.
export function getLeadTimeHours(workOrder, now = Date.now()) {
  const startMs = new Date(workOrder.time.start).getTime();
  if (!Number.isFinite(startMs)) return Infinity;
  return (startMs - now) / (60 * 60 * 1000);
}

// Minimum acceptable total pay for this work order given how far out it starts.
// Granite-premium tickets are exempt (threshold 0). Walks LEAD_TIME_TIERS and
// returns the first tier whose maxLeadHours covers the lead time; the final
// tier (maxLeadHours: null) is the catch-all for far-out jobs.
function minPayForLeadHours(leadHours) {
  const tiers = CONFIG.STRATEGY?.LEAD_TIME_TIERS || [];
  for (const tier of tiers) {
    if (tier.maxLeadHours == null || leadHours <= tier.maxLeadHours) {
      return tier.minPay ?? 0;
    }
  }
  return 0;
}

export function getMinPayThreshold(workOrder, now = Date.now()) {
  if (isGranitePremium(workOrder)) return 0;
  return minPayForLeadHours(getLeadTimeHours(workOrder, now));
}

function calendarDayIndex(d) {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

// Guards against "date slippage": a small job requested for a near date (low
// bar) gets calendar-countered to a LATER calendar day, quietly booking small
// work into an advance slot the strategy would never have accepted up front.
// Re-evaluates the pay threshold against the counter slot's lead time and
// returns true when the job no longer clears it. Only fires on a later calendar
// day (same-day time shifts keep the original horizon). Granite-premium is
// exempt; no-op when the strategy is disabled.
export function shouldSkipAdvanceCounter(workOrder, counterStart, now = Date.now()) {
  if (!isStrategyEnabled()) return false;
  if (isGranitePremium(workOrder)) return false;
  if (!(counterStart instanceof Date) || Number.isNaN(counterStart.getTime())) {
    return false;
  }

  const requestedStart = new Date(workOrder.time.start);
  if (Number.isNaN(requestedStart.getTime())) return false;

  // Only applies when the counter moves the job to a later calendar day.
  if (calendarDayIndex(counterStart) <= calendarDayIndex(requestedStart)) {
    return false;
  }

  const leadHours = (counterStart.getTime() - now) / (60 * 60 * 1000);
  const minPay = minPayForLeadHours(leadHours);
  const isHourly = workOrder.payType === "hourly" || workOrder.hourlyRate > 0;
  const estHours =
    workOrder.estLaborHours || CONFIG.TIME?.DEFAULT_LABOR_HOURS || 2;
  const rate = getWorkOrderRate(workOrder);
  const baseRate =
    workOrder.platform === "FieldNation"
      ? CONFIG.RATES?.BASE_HOURLY_RATE_FIELDNATION || CONFIG.RATES?.BASE_HOURLY_RATE
      : CONFIG.RATES?.BASE_HOURLY_RATE_WORKMARKET || CONFIG.RATES?.BASE_HOURLY_RATE;
  const counterRate = Math.max(rate, CONFIG.IS_COUNTER_RATES ? baseRate : rate);
  const effectivePay = isHourly
    ? counterRate * estHours
    : getWorkOrderTotalPay(workOrder);

  return effectivePay < minPay;
}

// Is this work order starting on the current calendar day (machine-local, to
// match how time.start is parsed elsewhere)?
function isSameDay(workOrder, now = Date.now()) {
  const start = new Date(workOrder.time.start);
  const today = new Date(now);
  return (
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth() &&
    start.getDate() === today.getDate()
  );
}

// Morning reserve (Phase B): for small (<BIG_TICKET_MIN), non-premium, same-day
// tickets, return the earliest acceptable start Date (mornings stay open for a
// potential big same-day job). Returns null when the rule does not apply.
export function getSameDaySmallEarliestStart(workOrder, now = Date.now()) {
  if (!isStrategyEnabled()) return null;
  const strat = CONFIG.STRATEGY || {};
  const earliestStr = strat.SAME_DAY_SMALL_EARLIEST_START;
  if (!earliestStr) return null;
  if (isGranitePremium(workOrder)) return null;
  if (!isSameDay(workOrder, now)) return null;
  if (getWorkOrderTotalPay(workOrder) >= (strat.BIG_TICKET_MIN ?? Infinity)) {
    return null;
  }
  const start = new Date(workOrder.time.start);
  const [h, m] = String(earliestStr).split(":").map(Number);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    h,
    m
  );
}

// Human-readable strategy context for a work order, used to enrich Telegram
// notifications so decisions reflect the lead-time strategy. Returns "" when
// the strategy is disabled (notifications stay as before).
export function describeStrategy(workOrder, now = Date.now()) {
  if (!isStrategyEnabled()) return "";

  if (isGranitePremium(workOrder)) {
    const capacity = getBookingCapacity(workOrder);
    const dbl = capacity >= 2 ? ` · ${capacity} techs` : "";
    return `🪨 Granite-Epik PREMIUM · priority, no min${dbl}`;
  }

  const leadHours = getLeadTimeHours(workOrder, now);
  const threshold = getMinPayThreshold(workOrder, now);
  const total = Math.round(getWorkOrderTotalPay(workOrder));
  const days = Math.max(0, Math.round(leadHours / 24));
  const tiers = CONFIG.STRATEGY?.LEAD_TIME_TIERS || [];
  const sameDayCutoff = tiers[0]?.maxLeadHours ?? 36;

  let band;
  if (leadHours <= sameDayCutoff) {
    band = `⚡ Same-day/urgent · min $${threshold}`;
  } else if (leadHours <= 168) {
    band = `📆 This week (${days}d out) · min $${threshold}`;
  } else {
    band = `🗓️ Advance (${days}d out) · min $${threshold}`;
  }
  return `${band} · offered $${total}`;
}

// Booking capacity (Phase C): number of jobs that may occupy the same time
// slot. Only >1 for Granite-premium tickets when TECHNICIAN_COUNT >= 2 and the
// strategy is enabled (the "me + brother" case). Defaults to 1 otherwise, which
// preserves the original single-booking availability behavior.
export function getBookingCapacity(workOrder) {
  if (!isStrategyEnabled()) return 1;
  if (!isGranitePremium(workOrder)) return 1;
  const count = CONFIG.STRATEGY?.TECHNICIAN_COUNT || 1;
  return count >= 2 ? count : 1;
}
