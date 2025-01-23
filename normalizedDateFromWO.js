export default function normalizeDateFromWO(data) {
    const startDate = data.time?.start?.date || data.date?.split(' to ')[0] || "Unknown";
    const startTime = data.time?.start?.time || (typeof data.time === 'string' && data.time.split(' to ')[0]) || "00:00:00";
    const endDate = data.time?.end?.date || data.date?.split(' to ')[1] || startDate; // Default to startDate if endDate is missing
    const endTime = data.time?.end?.time || (typeof data.time === 'string' && data.time.split(' to ')[1]?.split("  ")[0] || "");

    let distanceValue;
    if (typeof data.distance === "string" && data.distance.includes(" mi")) {
        distanceValue = parseFloat(data.distance.replace(" mi", ""));
    } else if (typeof data.distance === "number") {
        distanceValue = data.distance;
    } else {
        distanceValue = 0; // Default for missing or invalid distance
    }

    return {
        id: data.id || data.workOrderId || null,
        platform: data.platform || "Unknown",
        company: data.company || "Unknown Company",
        title: data.title || "No Title Provided",
        time: {
            start: `${startDate}T${startTime}`,
            end: `${endDate}T${endTime}`,
        },
        payRange: {
            min: data.payRange?.min || parseFloat(data.hourlyRate || 0) ,
            max: data.payRange?.max || parseFloat(data.totalPayment || 0),
        },
        estLaborHours: data.estLaborHours || parseFloat(data.hoursOfWork || 0) || 0,
        distance: distanceValue,
    };
}

// export default function normalizeDateFromWO(data) {
//     // Helper function to parse and format the date
//     function parseDate(inputDate) {
//         if (!inputDate) return null;
//         const parsedDate = new Date(inputDate);
//         if (!isNaN(parsedDate)) return parsedDate.toISOString().split('T')[0];
//         // Try to manually parse non-standard formats (e.g., "Mon, 01/20/2025")
//         const match = inputDate.match(/(\d{2})\/(\d{2})\/(\d{4})/); // Extract MM/DD/YYYY
//         if (match) return `${match[3]}-${match[1]}-${match[2]}`; // Convert to YYYY-MM-DD
//         return null;
//     }
//
//     const rawStartDate = data.time?.start?.date || data.date?.split(' to ')[0]?.trim() || "Unknown";
//     const startDate = parseDate(rawStartDate);
//     const startTime = data.time?.start?.time || (typeof data.time === 'string' && data.time.split(' to ')[0]?.split(' ')[0]?.trim()) || "00:00:00";
//
//     if (!startDate || startTime === "00:00:00") {
//         throw new RangeError(`Missing or invalid start date/time in data: ${JSON.stringify(data)}`);
//     }
//
//     const startDateTime = `${startDate}T${startTime}`;
//     // if (isNaN(startDateTime.getTime())) {
//     //     throw new RangeError(`Invalid start date or time: ${startDate} ${startTime}`);
//     // }
//
//     const rawEndDate = data.time?.end?.date || data.date?.split(' to ')[1]?.trim() || rawStartDate;
//     const endDate = parseDate(rawEndDate);
//     const endTime = data.time?.end?.time || (typeof data.time === 'string' && data.time.split(' to ')[1]?.split(' ')[0]?.trim()) || "";
//
//     const testTime = new Date()
//
//     let endDateTime;
//
//     if (endTime) {
//         endDateTime = `${endDate}T${endTime}`;
//     } else {
//         const startDateObj = new Date(startDateTime);
//         startDateObj.setHours(startDateObj.getHours() + 3); // Add 3 hours to start time
//         endDateTime = startDateObj.toISOString();
//     }
//
//     let distanceValue;
//     if (typeof data.distance === "string" && data.distance.includes(" mi")) {
//         distanceValue = parseFloat(data.distance.replace(" mi", ""));
//     } else if (typeof data.distance === "number") {
//         distanceValue = data.distance;
//     } else {
//         distanceValue = 0; // Default for missing or invalid distance
//     }
//
//     return {
//         id: data.id || data.workOrderId || null,
//         platform: data.platform || "Unknown",
//         company: data.company || "Unknown Company",
//         title: data.title || "No Title Provided",
//         time: {
//             start: startDateTime.toISOString(),
//             end: endDateTime,
//         },
//         payRange: {
//             min: data.payRange?.min || parseFloat(data.hourlyRate || 0),
//             max: data.payRange?.max || parseFloat(data.totalPayment || 0),
//         },
//         estLaborHours: data.estLaborHours || parseFloat(data.hoursOfWork || 0) || 0,
//         distance: distanceValue,
//     };
// }



//test cases

const WMorder = {
    id: '7637118552',
    platform: 'WorkMarket',
    company: 'Granite Telecommunications',
    title: 'Smart Hands | Priority 3 - Work Market',
    hourlyRate: '50.00',
    hoursOfWork: '4',
    totalPayment: '200.00',
    date: 'Mon, 01/20/2025 to Mon, 01/20/2025',
    time: '9:00 AM to 5:00 PM  EST',
    distance: '56 mi'
}

const WMorderV2 = {
    workOrderId: '5659140276',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    company: 'Endeavor Managed Services',
    hourlyRate: null,
    hoursOfWork: null,
    totalPayment: '187.58',
    date: 'Fri, 01/17/2025',
    time: '9:00 AM  EST',
    distance: '39.6 mi'
}



const FNorder = {
    id: 16510028,
    platform: 'FieldNation',
    company: 'Worldlink Integration Group',
    title: 'Petco #2719 - Tech Stack Upgrade | Install (1) Desktop, (1) Label Printer, (1) Laptop, (1) Docking Station',
    time: {
        start: {date: '2025-01-20', time: '13:00:00'},
        end: {date: '', time: ''}
    },
    payRange: {min: 165, max: 165},
    estLaborHours: 3,
    distance: 11

}

const oldresultData = {
    id: '5659140276',
    platform: 'FieldNation',
    company: 'Endeavor Managed Services',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    time: {
        start: {date: '2025-02-11', time: '09:00:00'},
        end: {date: '2025-02-11', time: '14:00:00'}
    },
    payRange: {min: 45, max: 270},
    estLaborHours: 6,
    distance: 11,
}

const newResultData = {
    id: '5659140276',
    platform: 'FieldNation',
    company: 'Endeavor Managed Services',
    title: 'Experienced Networking/Cabling tech Needed - Exterior Wall-Mount Installation\t LTE/5G Cradlepoint Installation - Work Market',
    time: {
        start: '2025-01-18T13:29:00',
        end: '2025-01-18T15:30:00'
    },
    payRange: {min: 45, max: 300},
    estLaborHours: 6,
    distance: 11,
}

console.log(normalizeDateFromWO(WMorder));
console.log(normalizeDateFromWO(WMorderV2));
console.log(normalizeDateFromWO(FNorder));