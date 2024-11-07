import { authorize } from '../../gmailAuth.js'; // Імпортуємо авторизацію
import { getLastUnreadEmail } from './getLastUnreadEmail.js'; // Приклад імпорту функції

/**
 * Функція для отримання посилання на замовлення з вмісту останнього листа
 * @param {string} emailBody - Текстовий вміст листа
 * @returns {string|null} - Посилання на замовлення або null, якщо не знайдено
 */
export function getLinkToLastOrder(emailBody) {
    // Регулярний вираз для пошуку посилання на замовлення
    const link = emailBody.match(/https:\/\/app\.fieldnation\.com\/workorders\/\d+\?t=ActionNewWorkOrder&src=Email/);

    if (link) {
        console.log(`Знайдено посилання на замовлення: ${link[0]}`);
        return link[0]; // Повертаємо перше знайдене посилання
    } else {
        console.log('Посилання на замовлення не знайдено.');
        return null;
    }
}

(async () => {
    try {
        const auth = await authorize();  // Авторизація
        const lastEmailBody = await getLastUnreadEmail(auth);  // Отримуємо вміст останнього листа

        if (lastEmailBody) {
            const orderLink = getLinkToLastOrder(lastEmailBody);  // Шукаємо посилання на замовлення
            console.log('Посилання на останнє замовлення:', orderLink);
        }
    } catch (error) {
        console.error('Помилка:', error);
    }
})();
