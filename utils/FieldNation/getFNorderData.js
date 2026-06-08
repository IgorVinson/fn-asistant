import fs from 'fs';
import path from 'path';


// Шлях до файлу з куками
const cookiesFilePath = path.resolve('utils', 'FieldNation', 'cookies.json');

// Функція для отримання куків
function getCookies() {
    if (!fs.existsSync(cookiesFilePath)) {
        throw new Error('Файл куків не знайдено!');
    }
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
    return cookiesJson.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// Функція для виконання запиту і аналізу даних
export async function getFNorderData(url) {
    try {

        const cookies = getCookies();

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

        // Calculate pay range properly based on pay type
        let payRange = { min: 0, max: 0 };
        let payType = "fixed"; // fixed | hourly | blended
        let hourlyRate = 0;
        // Preserves the raw blended (base + additional) shape so counter offers
        // can mirror the order's pay exactly instead of flattening to "fixed".
        let payStructure = null;
        const pay = workOrder.pay;

        if (pay.type === 'hourly' || (pay.rate && pay.rate.pay)) {
            // Hourly rate
            payType = "hourly";
            hourlyRate = pay.rate?.pay || pay.range?.min || 0;
            const estHours = workOrder.schedule.est_labor_hours || 2;
            payRange = {
                min: Math.round(hourlyRate * 1),
                max: Math.round(hourlyRate * estHours),
            };
        } else if (pay.type === 'blended' && pay.base && pay.additional) {
            // Blended ("combined"): fixed base for N hours + hourly for extra.
            payType = "blended";
            payStructure = {
                type: "blended",
                base: { units: pay.base.units, amount: pay.base.amount },
                additional: {
                    units: pay.additional.units,
                    amount: pay.additional.amount,
                },
            };
            payRange = pay.range && pay.range.max > 0
                ? pay.range
                : {
                    min: pay.base.amount || 0,
                    max: (pay.base.amount || 0) +
                        (pay.additional.units || 0) * (pay.additional.amount || 0),
                };
        } else if (pay.range && pay.range.min > 0 && pay.range.max > 0) {
            // Fixed with valid range
            payType = "fixed";
            payRange = pay.range;
        } else if (pay.range) {
            // Fallback to whatever range exists
            payType = "fixed";
            payRange = {
                min: pay.range.min || 0,
                max: pay.range.max || pay.range.min || 0,
            };
        }

        return {
            id: workOrder.id,
            platform: "FieldNation",
            company: workOrder.company.name,
            title: workOrder.title,
            time: {
                start: workOrder.schedule.service_window.start.local,
                end: workOrder.schedule.service_window.end.local
            },
            payRange: payRange,
            payType: payType,
            payStructure: payStructure,
            hourlyRate: hourlyRate,
            estLaborHours: workOrder.schedule.est_labor_hours,
            distance: Math.floor(Number(workOrder.coords.distance)),
        };


    } catch (error) {
        console.error('Помилка:', error.message);
        return null;
    }
}

