import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";

export function isPaymentEligible(workOrder) {
  let estLaborHours =
    workOrder.estLaborHours || CONFIG.TIME.DEFAULT_LABOR_HOURS;
  const TRAVEL_THRESHOLD = CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES;

  const MIN_PAY_THRESHOLD =
    workOrder.platform === "WorkMarket"
      ? CONFIG.RATES.MIN_PAY_THRESHOLD_WORKMARKET
      : CONFIG.RATES.MIN_PAY_THRESHOLD_FIELDNATION;

  const travelExpense =
    workOrder.distance > TRAVEL_THRESHOLD
      ? workOrder.distance * CONFIG.DISTANCE.TRAVEL_RATE_PER_MILE
      : 0;

  let decisionReason = "";

  if (workOrder.distance > TRAVEL_THRESHOLD) {
    decisionReason = `Travel required: Distance ${
      workOrder.distance
    } miles > ${TRAVEL_THRESHOLD} miles threshold. Base pay $${
      workOrder.payRange.max
    } + travel $${travelExpense.toFixed(2)} needed`;

    logger.info(
      `Payment Analysis:
      - Platform: ${workOrder.platform}
      - Offered Pay: $${workOrder.payRange.max}
      - Minimum Threshold: $${MIN_PAY_THRESHOLD}
      - Distance: ${workOrder.distance} miles
      - Travel Threshold: ${TRAVEL_THRESHOLD} miles
      - Travel Expense: $${travelExpense.toFixed(2)}
      - Required Pay: $${workOrder.payRange.max} + $${travelExpense.toFixed(
        2
      )} (travel)
      - Decision: REJECT (Counter offer needed for travel)
      - Reason: ${decisionReason}`,
      workOrder.platform,
      workOrder.id
    );

    return false;
  }

  if (workOrder.payRange.max < MIN_PAY_THRESHOLD) {
    decisionReason = `Base pay too low ($${workOrder.payRange.max} < $${MIN_PAY_THRESHOLD}) and distance (${workOrder.distance} miles) is within free travel limit (${TRAVEL_THRESHOLD} miles)`;
  } else {
    decisionReason = `Base pay acceptable: $${workOrder.payRange.max} >= $${MIN_PAY_THRESHOLD} and no travel required`;
  }

  logger.info(
    `Payment Analysis:
    - Platform: ${workOrder.platform}
    - Offered Pay: $${workOrder.payRange.max}
    - Minimum Threshold: $${MIN_PAY_THRESHOLD}
    - Distance: ${workOrder.distance} miles
    - Travel Threshold: ${TRAVEL_THRESHOLD} miles
    - Travel Expense: $${travelExpense.toFixed(2)}
    - Required Pay: ${MIN_PAY_THRESHOLD}
    - Decision: ${
      workOrder.payRange.max >= MIN_PAY_THRESHOLD ? "ACCEPT" : "REJECT"
    }
    - Reason: ${decisionReason}`,
    workOrder.platform,
    workOrder.id
  );

  return workOrder.payRange.max >= MIN_PAY_THRESHOLD;
}
