import fs from 'fs';
import path from 'path';

async function main() {
    const orderId = '18417038';
    const url = `https://app.fieldnation.com/workorders/${orderId}?t=ActionNewWorkOrder&src=Email`;
    
    console.log(`Fetching raw data for order: ${orderId}...`);
    
    // We want to see the RAW work_order object before it's processed by our getFNorderData
    // So let's modify a bit to capture the raw JSON
    
    const cookiesFilePath = path.resolve(process.cwd(), "src", "services", "platforms", "fieldnation", "cookies.json");
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
    const cookieString = cookiesJson.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const response = await fetch(url, {
        headers: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "cookie": cookieString,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        },
        method: "GET"
    });

    if (!response.ok) {
        console.error(`HTTP error: ${response.status}`);
        return;
    }

    const text = await response.text();
    const start = "<script type=\"text/javascript\">window.work_order =";
    const end = ";</script>";
    const workOrderRegEx = new RegExp(start + "(.+?)" + end, "m");
    const match = workOrderRegEx.exec(text);

    if (match) {
        const workOrder = JSON.parse(match[1].trim());
        console.log("--- WORK ORDER SUMMARY ---");
        console.log(`ID: ${workOrder.id}`);
        console.log(`Title: ${workOrder.title}`);
        console.log(`Company: ${workOrder.company?.name}`);
        
        console.log("\n--- Pay Info ---");
        console.log(JSON.stringify(workOrder.pay, null, 2));
        
        console.log("\n--- Schedule Info ---");
        console.log(JSON.stringify(workOrder.schedule, null, 2));

        console.log("\n--- Fields related to 'hour' ---");
        function findHourFields(obj, path = '') {
            if (!obj || typeof obj !== 'object') return;
            for (const key in obj) {
                const currentPath = path ? `${path}.${key}` : key;
                if (key.toLowerCase().includes('hour')) {
                    console.log(`${currentPath}: ${JSON.stringify(obj[key])}`);
                }
                if (typeof obj[key] === 'object') {
                    findHourFields(obj[key], currentPath);
                }
            }
        }
        findHourFields(workOrder);

        console.log("\n--- Description ---");
    } else {
        console.log("Could not find window.work_order in the response.");
        // Write HTML to file for debugging
        fs.writeFileSync('debug_fn_response.html', text);
        console.log("Saved response HTML to debug_fn_response.html");
    }
}

main().catch(console.error);
