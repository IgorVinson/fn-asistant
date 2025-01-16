import {saveCookies} from "../saveCookies.js";


export async function loginToWorkMarket(browser) {

    const url = 'https://www.workmarket.com/login';
    const page = await browser.newPage();

    try {
        // Переходимо на сторінку замовлення
        await page.goto(url, {waitUntil: 'load'});

        // Введення username
        await page.waitForSelector('#login-email'); // Чекаємо на появу поля username
        await page.type('#login-email', 'igorvinson@gmail.com', {delay: Math.random() * 100}); // Вводимо username (емейл)
        // await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення username

        // Чекаємо на навігацію або оновлення

        await page.waitForSelector('#login-password', {visible: true}); // Чекаємо на появу поля для пароля
        await page.type('#login-password', 'YOUR_PASSWORD_HERE', {delay: Math.random() * 100}); // Вводимо пароль
        await page.click('#login_page_button');
        await page.waitForNavigation(); // Чекаємо на навігацію після входу

        await saveCookies(page, 'WorkMarket');

    } catch (error) {
        console.error('Помилка з Cookies:', error.message,);
    }

}



