import fs from 'fs';
import path from 'path';

const cookiesFilePath = path.resolve('utils', 'WorkMarket', 'cookies.json');

function getCookies() {
    try {
        if (!fs.existsSync(cookiesFilePath)) {
            throw new Error('Cookies file not found!');
        }

        const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));

        if (!Array.isArray(cookiesJson)) {
            throw new Error('Invalid cookies format: Expected an array of cookie objects');
        }

        // Filter valid cookies with name and value, and join them into a cookie string
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
        return null; // Return null if any error occurs
    }
}

export async function getWMorderData(url) {

    try {
        const cookies = await getCookies();

        const response = await fetch(url, {
            headers: {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9",
                "cache-control": "max-age=0",
                "priority": "u=0, i",
                "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": '"macOS"',
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "Referer": "https://www.workmarket.com/login?redirectTo=/assignments/details/5456662857",
                "cookie": cookies,
                "Referrer-Policy": "strict-origin-when-cross-origin",
            },
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const body = await response.text();

        const workOrderIdMatch = body.match(/<h2 class="assignment-header">[\s\S]*?<small>\(ID:\s*(\d+)\)<\/small>/);
        const workOrderId = workOrderIdMatch ? workOrderIdMatch[1] : null;


        // Regular expressions to extract data
        const titleMatch = body.match(/<title>(.*?)<\/title>/);
        const companyMatch = body.match(/<a href="\/profile\/company\/\d+">(.*?)<\/a>/);
        const hourlyRateMatch = body.match(/\$([0-9.]+)\/hr/);
        const hoursOfWorkMatch = body.match(/\(up to ([0-9]+)hr\)/);
        const totalPaymentMatch = body.match(/<td>\s*<strong>\s*\$([0-9.]+)/);
        const distanceMatch = body.match(/\(([\d.]+ mi)\)/);
        let date = null;
        let time = null;

        const ddMatches = body.match(/<dd>.*?<\/dd>/gs);
        const secondDd = ddMatches[1];

        if (secondDd) {
            // Extract the full date range string
            const dateRangeMatch = secondDd.match(/<strong>([\s\S]*?)<\/strong>/);
            const timeMatch = secondDd.match(/<br\/>\s*([0-9:AMP ]+)\s*(?:to\s*([0-9:AMP ]+))?/);

            const dateRange = dateRangeMatch ? dateRangeMatch[1].trim().replace(/\s+/g, ' ') : null; // Normalize whitespace
            const startTime = timeMatch ? timeMatch[1] : null; // Extracts "8:00 AM"
            const endTime = timeMatch && timeMatch[2] ? timeMatch[2] : null; // Extracts "10:00 AM" if present

            date = dateRange || null;
            time = endTime ? `${startTime} to ${endTime} EST` : `${startTime} EST`;

        } else {
            console.log("Second <dd> element not found.");
        }

        // Extract and log the data
        const title = titleMatch ? titleMatch[1].trim() : null;
        const company = companyMatch ? companyMatch[1].trim() : null;
        const hourlyRate = hourlyRateMatch ? hourlyRateMatch[1] : null;
        const hoursOfWork = hoursOfWorkMatch ? hoursOfWorkMatch[1] : null;
        const totalPayment = totalPaymentMatch ? totalPaymentMatch[1] : null;
        const distance = distanceMatch ? distanceMatch[1] : null;

        return {
            id: workOrderId,
            platform: "WorkMarket",
            company,
            title,
            hourlyRate,
            hoursOfWork,
            totalPayment,
            date,
            time,
            distance
        };

    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}
