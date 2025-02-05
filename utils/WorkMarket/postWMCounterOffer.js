import fs from 'fs';
import path from 'path';

function getCookies() {
    const cookiesFilePath = path.resolve('utils', 'WorkMarket', 'cookies.json');
    if (!fs.existsSync(cookiesFilePath)) {
        throw new Error('Cookies file not found!');
    }
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
    return cookiesJson.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

export async function postWMCounterOffer(workOrderId, originalPayment, travelExpense) {
    try {
        const cookies = getCookies();
        const csrfCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('CSRFToken='));
        if (!csrfCookie) {
            throw new Error('CSRFToken cookie not found');
        }
        const CSRFToken = csrfCookie.split('=')[1];

        const response = await fetch(`https://www.workmarket.com/assignments/negotiate/${workOrderId}`, {
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
                "cache-control": "max-age=0",
                "content-type": "application/x-www-form-urlencoded",
                "sec-ch-ua": "\"Not A(Brand\";v=\"8\", \"Chromium\";v=\"132\", \"Google Chrome\";v=\"132\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": cookies,
                "Referer": `https://www.workmarket.com/assignments/details/${workOrderId}`,
                "Referrer-Policy": "strict-origin-when-cross-origin"
            },
            body: `_tk=${CSRFToken}&is_internal_pricing=false&has_tiered_pricing=false&priceType=1&price_negotiation=on&pricing=1&flat_price=${originalPayment}&additional_expenses=${travelExpense}&reschedule_option=time&note=travel&isform=true&submit=`,
            method: "POST"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.text();
    } catch (error) {
        console.error('Error posting counter offer:', error);
        throw error;
    }
} 