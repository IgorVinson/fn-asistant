import express from 'express';
import {getLastUnreadEmail} from "./utils/gmail/getLastUnreadEmail.js";
import {authorize} from "./utils/gmail/login.js";
import {getOrderLink} from "./utils/gmail/getOrderLink.js";
import {google} from "googleapis";
import {loginToFieldNation} from "./utils/FieldNation/loginToFieldNation.js";
import puppeteer from "puppeteer";
import {getFNorderData} from "./utils/FieldNation/getFNorderData.js";
import {postWorOrderRequest} from "./utils/FieldNation/postWorOrderRequest.js";
import {sendWorkOrderMessage} from "./utils/FieldNation/sendWorkOrderMessage.js";
import {loginToWorkMarket} from "./utils/WorkMarket/loginToWorkMarket.js";

// Налаштовуємо сервер
const app = express();
const port = 3000;

// Перевірка листів кожні 1 хвилину

const browser = await puppeteer.launch({headless: false}); // headless: false дозволить бачити браузер
await loginToFieldNation(browser);
await loginToWorkMarket(browser);

// const browserWM = await puppeteer.launch({headless: false});
//
// await loginToWorkMarket(browserWM);

// const pageWM = await browser.newPage();
// await pageWM.goto('https://www.workmarket.com/login')

// async function periodicCheck() {
//     const auth = await authorize();
//     const gmail = await google.gmail({version: 'v1', auth});
//     try {
//
//         setInterval(async () => {
//             const lastEmailBody = await getLastUnreadEmail(auth, gmail);
//
//             if (lastEmailBody) {
//                 // Виводимо посилання з листа
//                 const orderLink = getOrderLink(lastEmailBody);
//
//                 // if(orderLink?.includes('fieldnation')) {
//                 //     try {
//                 //         const page = await browser.newPage();
//                 //         await page.goto(orderLink, { waitUntil: 'load' });
//                 //
//                 //         // extractData(browser, page);
//                 //         // console.log(laborAmount)
//                 //     }
//                 //     catch (error) {
//                 //         console.error('Error during navigation:', error);
//                 //     }
//                 //
//                 //
//                 // }
//                 // else {
//                 //     try {
//                 //         const encodedOrderLink = encodeURI(orderLink);
//                 //         const page = await browser.newPage();
//                 //         await page.goto(encodedOrderLink, { waitUntil: 'load' });
//                 //         //{labor, hours, title, description, date, distance}
//                 //
//                 //     } catch (error) {
//                 //         console.error('Error during navigation:', error);
//                 //     }
//                 // }
//
//                 console.log("order`s link", orderLink);
//
//                 const data = await getFNorderData(orderLink);
//
//                 if (!data) {
//                     console.log('Помилка: Дані відсутні.');
//                     return;
//                 }
//
//                 const {startDateAndTime, distance, payRange, estLaborHours} = data;
//
//                 // Константи для розрахунків
//                 const SPEED = 50; // Середня швидкість у милях на годину
//                 const FREE_TRAVEL_LIMIT = 50 / 60; // Безкоштовний час у годинах (50 хв = 50 / 60)
//                 const TRAVEL_RATE = 30; // Ставка за годину дороги
//                 const MIN_PAY_THRESHOLD = 150; // Мінімальна оплата за виїзд
//
//                 // Розрахунок часу в дорозі з урахуванням поїздки "туди і назад"
//                 const travelTime = Math.max(0, (distance / SPEED) * 2 - FREE_TRAVEL_LIMIT);
//
//                 // Розрахунок мінімальної необхідної оплати
//                 const minPay = distance < 20 ? MIN_PAY_THRESHOLD : MIN_PAY_THRESHOLD + travelTime * TRAVEL_RATE;
//
//                 if (payRange.max / estLaborHours >= 50 && payRange.max >= minPay) {
//                     console.log('Відповідає умовам, подаю заявку.');
//                     await postWorOrderRequest(orderLink, startDateAndTime.local, estLaborHours);
//                     await sendWorkOrderMessage(orderLink);
//                 } else {
//                     console.log('Не відповідає умовам, не подаю заявку.');
//                 }
//             }
//         }, 10000); // Перевіряємо кожні 10 секунд
//     } catch (error) {
//         console.error('Error during authorization or email check:', error);
//     }
// }

// Старт сервера
app.listen(port, async () => {
    console.log(`Сервер запущено на порту ${port}`);
    // periodicCheck();
});