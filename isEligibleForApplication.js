const FNnormilizedData = {
    title: 'Walgreens POS Logic unit / Printer / ELO Refresh (Assist)',
    startDateAndTime: {
        local: { date: '2025-02-11', time: '09:00:00' },
        utc: '2025-02-11 14:00:00'
    },
    distance: 11.17511551089284,
    payRange: { min: 45, max: 270 },
    estLaborHours: 6,
    platform: 'FieldNation'
}


const WMnormalizedData = {
    workOrderId: '5659140276',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    startDateAndTime: 'Fri, 01/17/2025 9:00 AM  EST',
    distance: 39.6,
    payRange: { min: 0, max: 187.58 },
    estLaborHours: 0,
    platform: 'WorkMarket'
}


function isEligibleForApplication(data) {
    const SPEED = 50; // Average speed in miles per hour
    const FREE_TRAVEL_LIMIT = 50 / 60; // Free travel time in hours
    const TRAVEL_RATE = 30; // Rate per hour of travel
    const MIN_PAY_THRESHOLD = 150; // Minimum pay for a trip

    const travelTime = Math.max(0, (data.distance / SPEED) * 2 - FREE_TRAVEL_LIMIT);
    const minPay = data.distance < 20
        ? MIN_PAY_THRESHOLD
        : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;

    let estLaborHours = data.estLaborHours;

    if(!data.estLaborHours) estLaborHours = 4;


    return data.payRange.max / estLaborHours >= 50 && data.payRange.max >= minPay;
}

console.log(isEligibleForApplication(FNnormilizedData))
console.log(isEligibleForApplication(WMnormalizedData))





