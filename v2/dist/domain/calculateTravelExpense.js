export function calculateTravelExpense(distanceMiles, policy) {
    const mileageTravel = Math.round(distanceMiles * policy.ratePerMile);
    if (policy.flatTravel > 0) {
        return Math.max(mileageTravel, policy.flatTravel);
    }
    if (distanceMiles > policy.thresholdMiles) {
        return mileageTravel;
    }
    return 0;
}
