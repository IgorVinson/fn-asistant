import { google } from "googleapis";
import { authorize as authorizeAtGmail } from "./login.js";
import { getLastUnreadEmail } from "./getLastUnreadEmail.js";
import { getOrderLink } from "./getOrderLink.js";


(async () => {
    try {
        // Авторизуємо користувача
        const auth = await authorizeAtGmail();
        const gmail = google.gmail({ version: "v1", auth });

        // Отримуємо вміст останнього непрочитаного листа
        const lastEmailBody = await getLastUnreadEmail(auth, gmail);

        if (lastEmailBody) {
            // Виводимо посилання з листа
            const orderLink = getOrderLink(lastEmailBody);
            console.log('Посилання на замовлення:', orderLink);
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
})();
