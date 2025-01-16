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
        // Отримуємо куки
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

        // Перевірка статусу відповіді
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
        return {
            title: workOrder.title,
            startDateAndTime: workOrder.schedule.service_window.start,
            distance: workOrder.coords.distance,
            payRange: workOrder.pay.range,
            estLaborHours: workOrder.schedule.est_labor_hours
        };

    } catch (error) {
        console.error('Помилка:', error.message);
        return null;
    }
}

