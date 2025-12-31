import {authorize as authorizeAtGmail} from "./login.js";
import {getLastUnreadEmail} from "./getLastUnreadEmail.js";
import { getOrderLink } from './getOrderLink.js';


(async () => {
    try {
        // Авторизуємо користувача
        const client = await authorizeAtGmail();

        // Отримуємо вміст останнього непрочитаного листа
        const lastEmailBody = await getLastUnreadEmail(client);

        if (lastEmailBody) {
            // Виводимо посилання з листа
            const orderLink = getOrderLink(lastEmailBody);
            console.log('Посилання на замовлення:', orderLink);
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
})();

