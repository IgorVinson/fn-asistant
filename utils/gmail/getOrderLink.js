import { log } from "console";

/**
 * Функція для отримання посилання на замовлення з вмісту останнього листа
 * @param {string} emailBody - Текстовий вміст листа
 * @returns {string|null} - Посилання на замовлення або null, якщо не знайдено
 */
export function getOrderLink(emailBody) {
    // Регулярний вираз для пошуку посилання на замовлення
    const fnLink = emailBody.match(/https:\/\/app\.fieldnation\.com\/workorders\/\d+\?t=ActionNewWorkOrder&src=Email/);
    const wmLink = emailBody.match(/https?:\/\/sendgrid\.workmarket\.com\/uni\/ls\/click\?upn=[^"]+/);

    console.log(wmLink[0])

    if (fnLink) {
        return fnLink[0]; 
    }
    if(wmLink) {
        return wmLink[0];
    }
    else {
        console.log('Посилання на замовлення не знайдено.');
        return null;
    }
}

