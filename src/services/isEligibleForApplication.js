import { CONFIG } from "../../config/config.js";
import logger from "../utils/logger.js";
import { isSlotAvailableCalendar } from "./calendarAvailability.js";
import { calculateCounterOffer } from "./counterOffer.js";
import { isPaymentEligible } from "./paymentEligibility.js";
import { isWithinWorkingHours } from "./workingHours.js";
import { isSlotAvailableWorkMarket } from "./workMarketAvailability.js";

async function isEligibleForApplication(workOrder) {
  // If FieldNation returns missing/zero ID, treat the job as unavailable and skip all checks
  // (Observed cases: `null` and `0`)
  if (
    workOrder?.platform === "FieldNation" &&
    (workOrder?.id == null || workOrder?.id === 0 || workOrder?.id === "0")
  ) {
    logger.info(
      `Job unavailable (id=${workOrder?.id}) - skipping eligibility checks`,
      workOrder?.platform,
      workOrder?.id
    );
    return {
      eligible: false,
      counterOffer: null,
      reason: "JOB_UNAVAILABLE",
    };
  }

  logger.info(
    `Checking eligibility - Distance: ${workOrder.distance}mi, Est. Hours: ${workOrder.estLaborHours}`,
    workOrder.platform,
    workOrder.id
  );

  // First check if the job is within working hours
  const isInWorkingHours = isWithinWorkingHours(
    workOrder.time.start,
    workOrder.time.end,
    workOrder
  );

  // If outside working hours, not eligible for direct application or counter-offer
  if (!isInWorkingHours) {
    logger.info(
      `Job rejected: Outside working hours (${CONFIG.TIME.WORK_START_TIME}-${CONFIG.TIME.WORK_END_TIME})`,
      workOrder.platform,
      workOrder.id
    );
    return {
      eligible: false,
      counterOffer: null, // No counter-offer for jobs outside working hours
      reason: "OUTSIDE_WORKING_HOURS",
    };
  }

  // Special handling for Granite Telecommunications - skip calendar and payment checks
  if (
    workOrder.platform === "WorkMarket" &&
    workOrder.company === "Granite Telecommunications"
  ) {
    logger.info(
      `Primary company detected (Granite Telecommunications) - skipping calendar and payment checks, only checking distance`,
      workOrder.platform,
      workOrder.id
    );

    // Only check if travel is required
    if (workOrder.distance > CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES) {
      logger.info(
        `Granite Telecommunications job requires travel (${workOrder.distance} miles > ${CONFIG.DISTANCE.TRAVEL_THRESHOLD_MILES} miles) - generating counter offer`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false,
        counterOffer: calculateCounterOffer(workOrder),
        reason: "GRANITE_TRAVEL_REQUIRED",
      };
    } else {
      logger.info(
        `Granite Telecommunications job within travel threshold - applying directly`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: true,
        counterOffer: null,
        reason: "GRANITE_ELIGIBLE",
      };
    }
  }

  // Check eligibility for both FieldNation and WorkMarket (non-Granite)
  if (
    workOrder.platform === "FieldNation" ||
    workOrder.platform === "WorkMarket"
  ) {
    // STEP 1: Check availability across ALL enabled calendars
    let slotAvailable = true;
    
    // 1. Check WorkMarket Schedule (if enabled)
    if (CONFIG.AVAILABILITY && CONFIG.AVAILABILITY.PROVIDER === "WORKMARKET") {
        const wmSlotAvailable = await isSlotAvailableWorkMarket(workOrder);
        if (!wmSlotAvailable) {
            slotAvailable = false;
            logger.info(
                `Job rejected: WorkMarket Schedule conflict detected`,
                workOrder.platform,
                workOrder.id
            );
        }
    }

    // 2. Check Google Calendar (if WorkMarket check passed or wasn't run)
    // We only proceed to check Google Calendar if the slot is still considered available
    if (slotAvailable) {
        const googleSlotAvailable = await isSlotAvailableCalendar(workOrder);
        if (!googleSlotAvailable) {
            slotAvailable = false;
            logger.info(
                `Job rejected: Google Calendar conflict detected`,
                workOrder.platform,
                workOrder.id
            );
        }
    }

    if (!slotAvailable) {
      return {
        eligible: false,
        counterOffer: null, 
        reason: "SLOT_UNAVAILABLE",
      };
    }

    // STEP 2: Check payment eligibility ONLY if calendar is available
    if (isPaymentEligible(workOrder)) {
      // Both calendar and payment are good - apply directly
      return {
        eligible: true,
        counterOffer: null,
        reason: "ELIGIBLE",
      };
    } else {
      // Calendar is available but payment is insufficient - generate counter offer
      logger.info(
        `Calendar available but payment insufficient - generating counter offer`,
        workOrder.platform,
        workOrder.id
      );
      return {
        eligible: false, // Changed from true to false
        counterOffer: calculateCounterOffer(workOrder),
        reason: "PAYMENT_INSUFFICIENT",
      };
    }
  }

  // Unknown platform
  logger.info(
    `Unknown platform: ${workOrder.platform}`,
    workOrder.platform,
    workOrder.id
  );

  return {
    eligible: false,
    counterOffer: null,
    reason: "UNKNOWN_PLATFORM",
  };
}

export default isEligibleForApplication;
