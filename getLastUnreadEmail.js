import { google } from 'googleapis';
import { authorize } from './auth.js';

/**
 * Отримати останній непрочитаний лист і вивести його вміст
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
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
        return;
    }

    // Отримати деталі листа за його ID
    const messageId = messages[0].id;
    const msg = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
    });

    // Вивести інформацію про лист
    const headers = msg.data.payload.headers;
    const subjectHeader = headers.find(header => header.name === 'Subject');
    const fromHeader = headers.find(header => header.name === 'From');
    const body = getMessageBody(msg.data.payload);

    console.log(`Від: ${fromHeader.value}`);
    console.log(`Тема: ${subjectHeader.value}`);
    console.log(`Вміст листа: \n${body}`);
}

/**
 * Функція для отримання текстового вмісту листа
 * @param {Object} payload
 * @returns {string}
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

    return body;
}


