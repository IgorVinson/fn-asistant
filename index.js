import {authorize as authorizeAtGmail} from "./gmailAuth.js";
import {getLastUnreadEmail} from "./utils/gmail/getLastUnreadEmail.js";
import { getLinkToLastOrder } from './utils/gmail/getLinkToLastOrder.js';
import {loginToFieldNation} from "./utils/loginToFieldNation.js"; // Функція для отримання посилання


(async () => {
    try {
        // Авторизуємо користувача
        const clientInGmail = await authorizeAtGmail();

        // Отримуємо вміст останнього непрочитаного листа
        const lastEmailBody = await getLastUnreadEmail(clientInGmail);

        if (lastEmailBody) {
            // Виводимо посилання з листа
            const orderLink = getLinkToLastOrder(lastEmailBody);
            console.log('Посилання на замовлення:', orderLink);
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
})();

loginToFieldNation('https://app.fieldnation.com/')

// const page = await loginToFieldNation('https://app.fieldnation.com/')
// const notifyButton = await page.waitForSelector('.IconButton__3SE5w')[4];
// await notifyButton.click();
