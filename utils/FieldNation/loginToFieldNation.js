import puppeteer from 'puppeteer';


export async function loginToFieldNation(browser, page) {

    const url = 'https://app.fieldnation.com/';

    try {
        // Переходимо на сторінку замовлення
        await page.goto(url, {waitUntil: 'load'});

        // Введення username
        await page.waitForSelector('#username'); // Чекаємо на появу поля username
        await page.type('#username', 'igorvinson@gmail.com', {delay: Math.random() * 100}); // Вводимо username (емейл)
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення username
        // Чекаємо на навігацію або оновлення

        await page.waitForSelector('#password', {visible: true}); // Чекаємо на появу поля для пароля
        await page.type('#password', 'N25z*D4eXiyuPM@', {delay: Math.random() * 100}); // Вводимо пароль
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення пароля
        await page.waitForNavigation(); // Чекаємо на навігацію після входу

    } catch (error) {
        console.error('Помилка при подачі заявки:', error);
    }

}


