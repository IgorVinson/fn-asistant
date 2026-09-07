import { CONFIG } from '../../config.js';
import { getCookieHeader } from '../cookieStore.js';

// Функція для виконання запиту і аналізу даних
export async function postFNworkOrderRequest(url, time, estHours) {
    try {
        const workOrderId = url.split('?')[0].split('/').pop();
        const cookies = getCookieHeader(
            'FieldNation',
            `https://app.fieldnation.com/v2/workorders/${workOrderId}/requests`
        );
        const etaStartLocal =
            (typeof time === 'string' ? time : null) ||
            time?.start ||
            time?.local;
        const hourEstimate = Number(estHours) || CONFIG.TIME.DEFAULT_LABOR_HOURS;

        if (!etaStartLocal) {
            throw new Error('FieldNation ETA start time is missing.');
        }

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
            body: JSON.stringify({
                "work_order_id": workOrderId,
                eta: {
                    start: { local: etaStartLocal },
                    hour_estimate: hourEstimate
                }
            }),
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
