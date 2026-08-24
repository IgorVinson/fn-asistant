import { getCookieHeader } from '../cookieStore.js';

export function parseFNWorkOrder(workOrder) {
    if (!workOrder || typeof workOrder !== 'object') {
        throw new Error('Invalid FieldNation work order data.');
    }

    // Unavailable or partially rendered orders can omit `pay`. Normalize them
    // to zero pay so eligibility rules reject them without crashing monitoring.
    const pay = workOrder.pay ?? {};
    const schedule = workOrder.schedule ?? {};
    const serviceWindow = schedule.service_window ?? {};
    const estLaborHours = Number(schedule.est_labor_hours) || 2;
    let payRange = { min: 0, max: 0 };
    let payType = 'fixed';
    let hourlyRate = 0;
    let payStructure = null;

    if (pay.type === 'hourly' || pay.rate?.pay) {
        payType = 'hourly';
        hourlyRate = pay.rate?.pay || pay.range?.min || 0;
        payRange = {
            min: Math.round(hourlyRate),
            max: Math.round(hourlyRate * estLaborHours),
        };
    } else if (pay.type === 'blended' && pay.base && pay.additional) {
        payType = 'blended';
        payStructure = {
            type: 'blended',
            base: { units: pay.base.units, amount: pay.base.amount },
            additional: {
                units: pay.additional.units,
                amount: pay.additional.amount,
            },
        };
        payRange = pay.range?.max > 0
            ? pay.range
            : {
                min: pay.base.amount || 0,
                max: (pay.base.amount || 0) +
                    (pay.additional.units || 0) * (pay.additional.amount || 0),
            };
    } else if (pay.range?.min > 0 && pay.range?.max > 0) {
        payRange = pay.range;
    } else if (pay.range) {
        payRange = {
            min: pay.range.min || 0,
            max: pay.range.max || pay.range.min || 0,
        };
    }

    const distance = Number(workOrder.coords?.distance);
    return {
        id: workOrder.id,
        platform: 'FieldNation',
        company: workOrder.company?.name || 'Unknown Company',
        title: workOrder.title || 'No Title',
        time: {
            start: serviceWindow.start?.local ?? null,
            end: serviceWindow.end?.local ?? null,
        },
        payRange,
        payType,
        payStructure,
        hourlyRate,
        estLaborHours,
        distance: Number.isFinite(distance) ? Math.floor(distance) : 0,
    };
}

// Функція для виконання запиту і аналізу даних
export async function getFNorderData(url) {
    try {

        const cookies = getCookieHeader('FieldNation', url);

        // Виконуємо запит
        const response = await fetch(url, {
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
                "cache-control": "max-age=0",
                "priority": "u=0, i",
                "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": cookies, // Додаємо куки
                "Referer": "https://app.fieldnation.com/workorders/",
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP помилка: ${response.status}`);
        }

        // Аналіз відповіді
        const text = await response.text();
        const start = "<script type=\"text/javascript\">window.work_order =";
        const end = ";</script>";
        const workOrderRegEx = new RegExp(start + "(.+?)" + end, "m");
        const match = workOrderRegEx.exec(text);

        if (!match) {
            throw new Error('Не вдалося знайти дані work_order.');
        }

        const workOrder = JSON.parse(match[1].trim());
        return parseFNWorkOrder(workOrder);


    } catch (error) {
        console.error('Помилка:', error.message);
        return null;
    }
}

