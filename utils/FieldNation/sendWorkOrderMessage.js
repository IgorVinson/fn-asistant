import { getCookieHeader } from '../cookieStore.js';

// Функція для виконання запиту і аналізу даних
export async function sendWorkOrderMessage(url = 'https://app.fieldnation.com/workorders/16550330') {
    try {
        const workOrderId = url.split('?')[0].split('/').pop();
        const cookies = getCookieHeader(
            'FieldNation',
            `https://app.fieldnation.com/v2/workorders/${workOrderId}/messages`
        );

        const message = "Hey! I'm a low-voltage and networking specialist based in NC, working with Granite Telecommunications — one of the largest telecom providers in the US. Most of my work comes through WorkMarket, where I've completed 500+ field service projects covering structured cabling, network infrastructure, and security systems. My FieldNation profile is lighter since I mainly operate on WorkMarket, but the experience and quality are the same. On-time, clean install, no callbacks. Looking forward to working together!";

        // Виконуємо запит
        await fetch(`https://app.fieldnation.com/v2/workorders/${workOrderId}/messages`, {
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
            body: JSON.stringify({to: {id: 0}, message , type: "REQUESTEDTECHS", notify: []}
            ),
            method: "POST",
        }).then(
            response => {
                if (response.ok) {
                    console.log("Message sent successfully!");
                }
            }
        ).catch(
            error => {
                console.error("Error sending message:", error);
            }
        )

        // Перевірка статусу відповіді
    } catch (error) {
        console.error('Помилка:', error.message);
        return null;
    }
}
