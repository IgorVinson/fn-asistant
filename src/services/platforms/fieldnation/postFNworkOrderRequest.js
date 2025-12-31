import fs from 'fs';
import path from 'path';

// Шлях до файлу з куками
const cookiesFilePath = path.resolve(process.cwd(), 'src', 'services', 'platforms', 'fieldnation', 'cookies.json');

// Функція для отримання куків
function getCookies() {
    if (!fs.existsSync(cookiesFilePath)) {
        throw new Error('Файл куків не знайдено!');
    }
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
    return cookiesJson.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

// Функція для виконання запиту і аналізу даних
export async function postFNworkOrderRequest(url, time, estHours) {

    console.log(time)

    try {
        // Отримуємо куки
        const cookies = getCookies();
        const workOrderId = url.split('?')[0].split('/').pop();

        // Виконуємо запит
        await fetch(`https://app.fieldnation.com/v2/workorders/${workOrderId}/requests?acting_user_id=0&clientPayTermsAccepted=true`, {
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
                    start: {local: time.local},
                    hour_estimate: estHours
                }

            }),
            method: "POST",
        }).then(
            response => {
                if (response.ok) {
                    console.log("Work order request sent successfully");
                }
            }
        ).catch(
            error => {
                console.error("Error sending work order request:", error);
            }
        )
        
    } catch (error) {
        console.error('Помилка:', error.message);
        return null;
    }
}
