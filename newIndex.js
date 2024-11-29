import express from 'express';
import {getLastUnreadEmail} from "./utils/gmail/getLastUnreadEmail.js";
import {authorize} from "./utils/gmail/login.js";
import {getOrderLink} from "./utils/gmail/getOrderLink.js";
import {google} from "googleapis";
import {loginToFieldNation} from "./utils/loginToFieldNation.js";

// Налаштовуємо сервер
const app = express();
const port = 3000;

// Перевірка листів кожні 1 хвилину
async function periodicCheck() {
    const auth = await authorize();
    const gmail = await google.gmail({ version: 'v1', auth });
    try {

        setInterval(async () => {
            const lastEmailBody = await getLastUnreadEmail(auth, gmail);

            if (lastEmailBody) {
                // Виводимо посилання з листа
                const orderLink = getOrderLink(lastEmailBody);
                if(orderLink?.includes('fieldnation')) {
                 await loginToFieldNation(orderLink)
                }
                console.log('Посилання на замовлення:', orderLink);

            }
        }, 5000); // Перевіряємо кожну 1 хвилин
    } catch (error) {
        console.error('Error during authorization or email check:', error);
    }
}


// Старт сервера
app.listen(port, async () => {
    console.log(`Сервер запущено на порту ${port}`);
    periodicCheck(); // Починаємо перевірку листів
});