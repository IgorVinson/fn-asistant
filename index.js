import {authorize} from "./auth.js";
import {getLastUnreadEmail} from "./utils/getLastUnreadEmail.js";
import { getLinkToLastOrder } from './utils/getLinkToLastOrder.js';
import {applyForJob} from "./utils/applyForJob.js"; // Функція для отримання посилання


(async () => {
    try {
        // Авторизуємо користувача
        const auth = await authorize();

        // Отримуємо вміст останнього непрочитаного листа
        const lastEmailBody = await getLastUnreadEmail(auth);

        if (lastEmailBody) {
            // Виводимо посилання з листа
            const orderLink = getLinkToLastOrder(lastEmailBody);
            console.log('Посилання на замовлення:', orderLink);
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
})();

applyForJob('https://app.fieldnation.com/')