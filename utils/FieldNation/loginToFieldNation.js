import {saveCookies} from "../saveCookies.js";


export async function loginToFieldNation(browser) {
    const email = process.env.FN_EMAIL;
    const password = process.env.FN_PASSWORD;
    if (!email || !password) {
        throw new Error('FN_EMAIL and FN_PASSWORD environment variables are required');
    }

    const url = 'https://app.fieldnation.com/';
    const page = await browser.newPage();

    try {
        // Переходимо на сторінку замовлення
        await page.goto(url, {waitUntil: 'load'});

        // Введення username
        await page.waitForSelector('#username'); // Чекаємо на появу поля username
        await page.type('#username', email, {delay: Math.random() * 100}); // Вводимо username (емейл)
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення username

        // Чекаємо на навігацію або оновлення

        await page.waitForSelector('#password', {visible: true}); // Чекаємо на появу поля для пароля
        await page.type('#password', password, {delay: Math.random() * 100}); // Вводимо пароль
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення пароля
        await page.waitForNavigation(); // Чекаємо на навігацію після входу

        await saveCookies(page, 'FieldNation');

    } catch (error) {
        console.error('Помилка з Cookies:', error.message,);
        throw error;
    }

}



