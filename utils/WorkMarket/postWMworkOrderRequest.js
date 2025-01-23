import fs from 'fs';
import path from 'path';

const cookiesFilePath = path.resolve('utils', 'WorkMarket', 'cookies.json');

// Function to get cookies
function getCookies() {
    try {
        if (!fs.existsSync(cookiesFilePath)) {
            throw new Error('Cookies file not found!');
        }

        const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
        if (!Array.isArray(cookiesJson)) {
            throw new Error('Invalid cookies format: Expected an array of cookie objects');
        }

        const cookies = cookiesJson
            .filter(cookie => typeof cookie.name === 'string' && typeof cookie.value === 'string')
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        if (!cookies) {
            throw new Error('No valid cookies found in the file');
        }

        return cookies;
    } catch (error) {
        console.error(`Error reading cookies: ${error.message}`);
        return null;
    }
}

// Function to post work order request
export async function postWMworkOrderRequest(url,date,hours, workOrderId) {


    try {
        // Get cookies
        const cookies = await getCookies();

        if (!cookies || typeof cookies !== 'string') {
            throw new Error('Cookies is not defined or not a string');
        }

        const csrfCookie = cookies.split(';').find(cookie => cookie.trim().startsWith('CSRFToken='));

        if (!csrfCookie) {
            throw new Error('CSRFToken cookie not found');
        }

        const CSRFToken = csrfCookie.split('=')[1];

        if (!CSRFToken) {
            throw new Error('CSRFToken value is undefined');
        }

        if (!cookies) {
            throw new Error('Failed to retrieve cookies.');
        }

        const response = await fetch(`https://www.workmarket.com/assignments/apply/${workOrderId}`, {
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9,uk-UA;q=0.8,uk;q=0.7,ru-UA;q=0.6,ru;q=0.5",
                "cache-control": "max-age=0",
                "content-type": "application/x-www-form-urlencoded",
                "sec-ch-ua": "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
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
            body: `_tk=${CSRFToken}&note=&tieredPricingAccepted=false&isform=true`,
            method: "POST"
        });

        // Check response
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Request failed with status ${response.status}: ${errorText}`);
        }

        console.log("Work order request sent successfully");
    } catch (error) {
        console.error("Error sending work order request:", error.message);
    }
}

// Call the function
await postWMworkOrderRequest();
