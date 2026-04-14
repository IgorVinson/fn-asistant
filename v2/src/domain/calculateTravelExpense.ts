import type { TravelPolicy } from "../config/policy.js";

export function calculateTravelExpense(
  distanceMiles: number,
  policy: TravelPolicy
): number {
  const mileageTravel = Math.round(distanceMiles * policy.ratePerMile);

  if (policy.flatTravel > 0) {
    return Math.max(mileageTravel, policy.flatTravel);
  }

  if (distanceMiles > policy.thresholdMiles) {
    return mileageTravel;
  }

  return 0;
}
