import { google } from 'googleapis';

export async function listUnreadEmailsFromFieldNation(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    // Запит на отримання непрочитаних листів від support@fieldnation.com
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread from:support@fieldnation.com', // Фільтруємо непрочитані листи від конкретного відправника
        maxResults: 10, // Отримати до 10 останніх листів
    });

    const messages = res.data.messages;

    if (!messages || messages.length === 0) {
        console.log('Немає нових листів від support@fieldnation.com.');
        return;
    }

    console.log('Непрочитані листи від support@fieldnation.com:');
    for (const message of messages) {
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
        });

        const headers = msg.data.payload.headers;
        const subjectHeader = headers.find(header => header.name === 'Subject');
        const fromHeader = headers.find(header => header.name === 'From');

        console.log(`- Від: ${fromHeader.value}, Тема: ${subjectHeader.value}`);
    }
}

