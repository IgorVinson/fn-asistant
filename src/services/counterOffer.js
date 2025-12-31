import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";

export function calculateCounterOffer(workOrder) {
  const BASE_HOURS = 2;
  const ADDITIONAL_HOURLY_RATE = 55;

  const MIN_PAY_THRESHOLD =
    workOrder.platform === "WorkMarket"
      ? CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET
      : CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION;

  const travelExpense =
    workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
      ? Math.round(workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE)
      : 0;

  const isFixedRate = workOrder.estLaborHours <= 2;
  const additionalHours = isFixedRate
    ? 0
    : Math.max(1, workOrder.estLaborHours - BASE_HOURS);

  let baseAmount;
  if (
    workOrder.payRange.max >= MIN_PAY_THRESHOLD &&
    workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES
  ) {
    baseAmount = workOrder.payRange.max;
  } else {
    baseAmount = MIN_PAY_THRESHOLD;
  }

  logger.info(
    `Counter offer calculation: Base: $${baseAmount} (${
      baseAmount === workOrder.payRange.max
        ? "offered amount"
        : "minimum threshold"
    }) + Travel: $${travelExpense} = Total: $${baseAmount + travelExpense}`,
    workOrder.platform,
    workOrder.id
  );

  return {
    shouldCounterOffer: true,
    payType: isFixedRate ? "fixed" : "blended",
    baseHours: isFixedRate ? 0 : BASE_HOURS,
    baseAmount: baseAmount,
    additionalHours: additionalHours,
    additionalAmount: isFixedRate ? 0 : ADDITIONAL_HOURLY_RATE,
    travelExpense: travelExpense,
  };
}
