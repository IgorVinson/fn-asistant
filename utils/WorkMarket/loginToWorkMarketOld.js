import {saveCookies} from "../saveCookies.js";

export async function loginToWorkMarketOld(page) {
    try {
        // Wait for the specific element (e.g., <h2>Ihor Tiazhkorob</h2>) indicating a successful login
        const elementSelector = 'h2'; // Replace with the correct selector if necessary
        await page.waitForFunction(
            (selector, expectedText) =>
                document.querySelector(selector)?.innerText.includes(expectedText),
            { timeout: 30000 }, // Adjust the timeout if needed
            elementSelector,
            'Ihor Tiazhkorob'
        );

        // Save cookies once the target element is found
        await saveCookies(page, 'WorkMarket');
        console.log('Target element found, cookies saved successfully.');

    } catch (error) {
        console.error('Target element not found or error occurred:', error.message);
    }
}




