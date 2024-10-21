import { google } from 'googleapis';

/**
 * Отримати останній непрочитаний лист і повернути його вміст
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @returns {Promise<string|null>} - Вміст останнього листа або null, якщо немає нових листів
 */
export async function getLastUnreadEmail(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    // Отримати останній непрочитаний лист
    const res = await gmail.users.messages.list({
        userId: 'me',
        labelIds: ['INBOX'], // Шукаємо тільки вхідні
        q: 'is:unread', // Тільки непрочитані листи
        maxResults: 1, // Отримати лише один лист (найновіший)
    });

    const messages = res.data.messages;

    if (!messages || messages.length === 0) {
        console.log('Немає нових непрочитаних листів.');
        return null;
    }

    // Отримати деталі листа за його ID
    const messageId = messages[0].id;
    const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
    });

    // Отримати текст листа
    const body = getMessageBody(msg.data.payload);

    if (body) {
        console.log(`Вміст останнього листа: \n${body}`);
        return body; // Повертаємо вміст листа
    } else {
        console.log('Не вдалося отримати вміст листа.');
        return null;
    }
}

/**
 * Функція для отримання текстового вмісту листа
 * @param {Object} payload
 * @returns {string|null}
 */
function getMessageBody(payload) {
    let body = '';

    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf8');
                break;
            }
        }
    } else if (payload.body && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return body ? body : null;
}
