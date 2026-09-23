import { CONFIG } from '../../config.js';
import { getCookieHeader } from '../cookieStore.js';

export function buildFNWorkOrderRequestBody(workOrderId, time, estHours) {
    const start = typeof time === 'string' ? time : time?.start || time?.local;
    // Normalized order times are wall-clock values in the order's timezone.
    // Split them directly: converting through Date/UTC can change the arrival time.
    const local = typeof start === 'string'
        ? start.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/)
        : null;
    const date = local ? local[1] : start?.date;
    const clock = local ? `${local[2]}:${local[3] || '00'}` : start?.time;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        typeof clock !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(clock)) {
        throw new Error('FieldNation ETA start time is missing or invalid.');
    }
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        throw new Error('FieldNation ETA start date is invalid.');
    }
    return {
        work_order_id: workOrderId,
        eta: {
            start: { local: { date, time: clock.length === 5 ? `${clock}:00` : clock } },
            hour_estimate: Number(estHours) || CONFIG.TIME.DEFAULT_LABOR_HOURS,
        },
    };
}

// Функція для виконання запиту і аналізу даних
export async function postFNworkOrderRequest(url, time, estHours) {
    try {
        const workOrderId = url.split('?')[0].split('/').pop();
        const requestBody = buildFNWorkOrderRequestBody(workOrderId, time, estHours);
        if (CONFIG.TEST_MODE) {
            const result = { status: 'test', message: 'TEST: FN application simulated; no submission',
                workOrderId, requestBody };
            console.log(result);
            return result;
        }
        const cookies = getCookieHeader(
            'FieldNation',
            `https://app.fieldnation.com/v2/workorders/${workOrderId}/requests`
        );
        const response = await fetch(`https://app.fieldnation.com/v2/workorders/${workOrderId}/requests?acting_user_id=${CONFIG.PLATFORMS.FIELD_NATION.USER_ID}&clientPayTermsAccepted=true`, {
            headers: {
                "accept": "application/json",
                "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
                "content-type": "application/json",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "cookie": cookies,
                "Referer": "https://app.fieldnation.com/workorders/16391887?work_order_rank=1&work_order_total=34&work_order_list=workorders_available",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            body: JSON.stringify(requestBody),
            method: "POST",
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `FieldNation request failed (${response.status}): ${errorText}`
            );
        }

        const responseText = await response.text();
        console.log("Work order request sent successfully", responseText);
        return responseText;
    } catch (error) {
        console.error('Помилка:', error.message);
        throw error;
    }
}
