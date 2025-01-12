import {saveCookies} from "../saveCookies.js";


export async function loginToWorkMarket(browser, page) {

    const url = 'https://www.workmarket.com/login';

    try {
        // Переходимо на сторінку замовлення
        await page.goto(url, {waitUntil: 'load'});

        await saveCookies(page, 'WorkMarket');

    } catch (error) {
        console.error('Помилка з Cookies:', error.message,);
    }

}



