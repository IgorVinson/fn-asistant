import { getCookieHeader } from '../cookieStore.js';

export class FNAuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FNAuthError';
        this.code = 'FN_AUTH_EXPIRED';
        this.authExpired = true;
    }
}

function getWorkOrderId(requestUrl) {
    return new URL(requestUrl).pathname.match(/^\/workorders\/(\d+)/)?.[1] || null;
}

function buildWorkOrderApiUrl(requestUrl, workOrderId) {
    return new URL(`/v2/workorders/${workOrderId}`, requestUrl).toString();
}

function isAuthenticationUrl(responseUrl) {
    if (!responseUrl) return false;

    const received = new URL(responseUrl);
    return (
        received.hostname !== 'app.fieldnation.com' ||
        /^\/(?:login|logout|oauth|oauth2|authorize|authentication)(?:\/|$)/i.test(
            received.pathname
        )
    );
}

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

export async function getFNorderData(url, dependencies = {}) {
    try {
        const getCookies = dependencies.getCookieHeader || getCookieHeader;
        const fetchPage = dependencies.fetch || fetch;
        const workOrderId = getWorkOrderId(url);
        if (!workOrderId) {
            throw new Error(`Invalid FieldNation work order URL: ${url}`);
        }

        // The browser-facing route now redirects authenticated users to the
        // schedule view. Fetch the canonical JSON resource instead.
        const apiUrl = buildWorkOrderApiUrl(url, workOrderId);
        let cookies;
        try {
            cookies = getCookies('FieldNation', apiUrl);
        } catch (error) {
            throw new FNAuthError(`FieldNation cookies are not usable: ${error.message}`);
        }

        const response = await fetchPage(apiUrl, {
            headers: {
                "accept": "application/json",
                "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
                "cache-control": "no-cache",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest",
                "cookie": cookies,
                "Referer": url,
            },
            method: "GET"
        });

        if (response.status === 401 || response.status === 403) {
            throw new FNAuthError(`FieldNation returned HTTP ${response.status}`);
        }

        if (isAuthenticationUrl(response.url)) {
            throw new FNAuthError(
                `FieldNation redirected the API request to ${response.url}`
            );
        }

        if (!response.ok) {
            throw new Error(`HTTP помилка: ${response.status}`);
        }

        const workOrder = typeof response.json === 'function'
            ? await response.json()
            : JSON.parse(await response.text());
        if (String(workOrder?.id) !== workOrderId) {
            throw new Error(`FieldNation returned invalid data for work order ${workOrderId}`);
        }

        return parseFNWorkOrder(workOrder);
    } catch (error) {
        console.error('Помилка:', error.message);
        if (error instanceof FNAuthError) throw error;
        return null;
    }
}

