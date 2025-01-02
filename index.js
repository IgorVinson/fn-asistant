import express from 'express';
import {getLastUnreadEmail} from "./utils/gmail/getLastUnreadEmail.js";
import {authorize} from "./utils/gmail/login.js";
import {getOrderLink} from "./utils/gmail/getOrderLink.js";
import {google} from "googleapis";
import {loginToFieldNation} from "./utils/FieldNation/loginToFieldNation.js";
import puppeteer from "puppeteer";
import {getWorkOrderData} from "./utils/getWorkOrderData.js";
import {postWorOrderRequest} from "./utils/postWorOrderRequest.js";
import {sendWorkOrderMessage} from "./utils/sendWorkOrderMessage.js";

// Налаштовуємо сервер
const app = express();
const port = 3000;

// Перевірка листів кожні 1 хвилину

const browser = await puppeteer.launch({headless: false}); // headless: false дозволить бачити браузер
const pageFN = await browser.newPage();

loginToFieldNation(browser, pageFN);
// const pageWM = await browser.newPage();
// await pageWM.goto('https://www.workmarket.com/login')

async function periodicCheck() {
    const auth = await authorize();
    const gmail = await google.gmail({version: 'v1', auth});
    try {

        setInterval(async () => {
            const lastEmailBody = await getLastUnreadEmail(auth, gmail);

            if (lastEmailBody) {
                // Виводимо посилання з листа
                const orderLink = getOrderLink(lastEmailBody);

                // if(orderLink?.includes('fieldnation')) {
                //     try {
                //         const page = await browser.newPage();
                //         await page.goto(orderLink, { waitUntil: 'load' });
                //
                //         // extractData(browser, page);
                //         // console.log(laborAmount)
                //     }
                //     catch (error) {
                //         console.error('Error during navigation:', error);
                //     }
                //
                //
                // }
                // else {
                //     try {
                //         const encodedOrderLink = encodeURI(orderLink);
                //         const page = await browser.newPage();
                //         await page.goto(encodedOrderLink, { waitUntil: 'load' });
                //         //{labor, hours, title, description, date, distance}
                //
                //     } catch (error) {
                //         console.error('Error during navigation:', error);
                //     }
                // }

                console.log("order`s link", orderLink);

                const data = await getWorkOrderData(orderLink);
                const time = data.startDateAndTime.local;
                const estHours = data.estLaborHours;
                console.log(data);

                await postWorOrderRequest(orderLink, time, estHours);
                await sendWorkOrderMessage(orderLink);

            }
        }, 15000); // Перевіряємо кожні 5 секунд
    } catch (error) {
        console.error('Error during authorization or email check:', error);
    }
}

// Старт сервера
app.listen(port, async () => {
    console.log(`Сервер запущено на порту ${port}`);
    periodicCheck(); // Починаємо перевірку листів
});