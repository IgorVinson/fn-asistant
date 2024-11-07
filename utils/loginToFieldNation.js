import puppeteer from 'puppeteer';

/**
 * Автоматизація подачі заявки через Puppeteer
 * @param {string} url - Посилання на замовлення
 */
export async function loginToFieldNation(url) {
    // Запуск браузера Puppeteer
    const browser = await puppeteer.launch({headless: false}); // headless: false дозволить бачити браузер
    const page = await browser.newPage();

    try {
        // Переходимо на сторінку замовлення
        await page.goto(url, {waitUntil: 'networkidle2'});

        // Введення username
        await page.waitForSelector('#username'); // Чекаємо на появу поля username
        await page.type('#username', 'igorvinson@gmail.com', {delay: Math.random() * 100}); // Вводимо username (емейл)
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення username
        // Чекаємо на навігацію або оновлення

        await page.waitForSelector('#password', {visible: true}); // Чекаємо на появу поля для пароля
        await page.type('#password', 'N25z*D4eXiyuPM@', {delay: Math.random() * 100}); // Вводимо пароль
        await page.click('button[type="submit"]'); // Натискаємо кнопку "Submit" після введення пароля
        await page.waitForNavigation(); // Чекаємо на навігацію після входу


        // Пошук усіх кнопок на сторінці
        const buttons = await page.$$('button'); // Знаходимо всі кнопки
        let requestButton = null;

        // Перебираємо всі кнопки і шукаємо ту, яка містить текст "Request"
        for (const button of buttons) {
            const text = await page.evaluate(el => el.textContent, button);
            if (text.includes('Request')) {
                requestButton = button;
                break;
            }
        }

        // Натискаємо кнопку, якщо її знайдено
        if (requestButton) {
            await requestButton.click();
            console.log('Кнопка "Request" успішно натиснута!');
        } else {
            console.log('Кнопку "Request" не знайдено.');
        }

    } catch (error) {
        console.error('Помилка при подачі заявки:', error);
    }
}


