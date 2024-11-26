import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import express from 'express';

// Отримуємо директорію файлу за допомогою import.meta.url
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const cookiesFilePath = path.resolve(__dirname, 'cookies.json'); // Шлях до файлу куків

// Глобальні змінні для браузера та сторінки
let browser = null;
let page = null;

/**
 * Логін до FieldNation з перевіркою наявності збережених куків
 */
export async function loginToFieldNation(url) {
    if (!browser) {
        // Якщо браузер ще не відкритий, відкриваємо новий
        browser = await puppeteer.launch({ headless: false }); // Запускаємо браузер
    }

    if (!page) {
        // Якщо сторінка ще не відкрита, відкриваємо нову сторінку
        page = await browser.newPage();
    }

    // Перевірка, чи є збережені куки
    if (fs.existsSync(cookiesFilePath)) {
        console.log('Завантажуємо збережені куки...');
        const cookiesString = fs.readFileSync(cookiesFilePath);
        const cookies = JSON.parse(cookiesString);

        // Завантажуємо куки в браузер
        for (let cookie of cookies) {
            await page.setCookie(cookie);
        }

        // Перевірка, чи не треба повторно логінитись
        await page.goto(url, { waitUntil: 'load' });
        console.log('Перевірка на сесію виконана, сесія активна.');
    } else {
        console.log('Куки не знайдено, виконуємо логін...');
        await page.goto(url, { waitUntil: 'load' });

        // Виконання логіну
        await page.waitForSelector('#username');
        await page.type('#username', 'igorvinson@gmail.com', { delay: Math.random() * 100 });
        await page.click('button[type="submit"]');
        await page.waitForSelector('#password');
        await page.type('#password', 'YOUR_PASSWORD_HERE', { delay: Math.random() * 100 });
        await page.click('button[type="submit"]');
        await page.waitForNavigation();

        // Збереження куків після успішного логіну
        const cookies = await page.cookies();
        fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies));
        console.log('Куки збережено.');
    }

    return { browser, page };
}

async function runActions() {
    try {
        const { page } = await loginToFieldNation('https://app.fieldnation.com/');
        await performActions(page);
    } catch (error) {
        console.error('Error in performing actions:', error);
    }
}

async function performActions(page) {
    try {
        // goto notifications
        await page.goto('https://app.fieldnation.com/users/983643/notifications')
        //click Unread
        await page.evaluate(() => {
            Array.from(document.querySelectorAll('span')).filter(span => {
                return span.innerText == 'Unread' // filter il for specific text
            }).forEach(element => {
                if (element) element.click(); // click on il with specific text
            });

        });

        await page.evaluate(() => {
            // Отримуємо всі span елементи на сторінці
            const spans = Array.from(document.querySelectorAll('span'));

            // Фільтруємо елементи, які містять текст 'WO'
            const filteredSpans = spans.filter(span => span.innerText.includes('WO'));

            // Повертаємо HTML-код знайдених елементів назад у Node.js контекст
            return filteredSpans.map(span => span.outerHTML);
        }).then(filteredSpans => {
            // Виводимо знайдені елементи в Node.js консоль
            if (filteredSpans.length > 0) {
                console.log('Знайдені елементи:');
                filteredSpans.forEach((element, index) => {
                    console.log(`Елемент ${index + 1}:`, element);
                });
            } else {
                console.log('Елементи не знайдені');
            }
        }).catch((error) => {
            console.error('Помилка при виконанні evaluate:', error);
        });



        await page.evaluate(() => {
            Array.from(document.querySelectorAll('span')).filter(span => {
                return span.innerText.includes('WO') // filter il for specific text
            }).forEach(element => {
                console.log(element);
                // if (element) element.click(); // click on il with specific text
            });
        }).catch(() => {
                console.log('Element not found');
            }
        );


    } catch (error) {
        console.error('Error during action execution:', error);
    }
}

// Старт серверу
app.listen(port, () => {
    console.log(`Сервер запущено на порту ${port}`);
    runActions(); // Запускаємо функцію дій
});




