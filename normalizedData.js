function normalizeData(data, platform) {

    if (platform === "FieldNation") {
        return {
            title: data.title,
            startDateAndTime: data.startDateAndTime,
            distance: data.distance,
            payRange: data.payRange,
            estLaborHours: data.estLaborHours,
            platform: "FieldNation",
        };
    } else if (platform === "WorkMarket") {
        return {
            workOrderId: data.workOrderId,
            title: data.title,
            startDateAndTime: `${data.date} ${data.time}`, // Combine date and time
            distance: parseFloat(data.distance?.replace(" mi", "")) || null,
            payRange: {

                min: parseFloat(data.hourlyRate || 0) ,
                max: parseFloat(data.totalPayment || 0),
            },
            estLaborHours: parseFloat(data.hoursOfWork || 0),
            platform: "WorkMarket",
        };
    }
    throw new Error("Unsupported platform for normalization.");
}

console.log(normalizeData( {
    workOrderId: '5659140276',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    company: 'Endeavor Managed Services',
    hourlyRate: null,
    hoursOfWork: null,
    totalPayment: '187.58',
    date: 'Fri, 01/17/2025',
    time: '9:00 AM  EST',
    distance: '39.6 mi'
}, 'WorkMarket'))

console.log(normalizeData( {
    title: 'Walgreens POS Logic unit / Printer / ELO Refresh (Assist)',
    startDateAndTime: {
        local: { date: '2025-02-11', time: '09:00:00' },
        utc: '2025-02-11 14:00:00'
    },
    distance: 11.17511551089284,
    payRange: { min: 45, max: 270 },
    estLaborHours: 6,
    platform: 'FieldNation'
}, 'FieldNation'))