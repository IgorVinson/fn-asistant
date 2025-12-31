/**
 * Get the latest unread email and return its content
 *
 * @param {OAuth2Client|OAuth2Client} auth An authorized OAuth2 client.
 * @param gmail Object for Gmail API interaction
 * @returns {Promise<string|null>} - Content of the latest email or null if no new emails
 */
export async function getLastUnreadEmail(auth, gmail) {

    // Get the latest unread email
    const res = await gmail.users?.messages.list({
        userId: 'me',
        labelIds: ['INBOX'], // Search only inbox
        q: 'is:unread', // Only unread emails
        maxResults: 1, // Get only one email (the newest)
    });

    const messages = res.data.messages;

    if (!messages || messages.length === 0) {
        console.log('No new unread emails.');
        return null;
    }

    // Get email details by its ID
    const messageId = messages[0].id;
    const msg = await gmail.users?.messages.get({
        userId: 'me',
        id: messageId,
    });

    // Change email status to read
    await gmail.users?.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
            removeLabelIds: ['UNREAD'],
        },
    });

    // Get email text
    const body = getMessageBody(msg.data.payload);

    if (body) {
        // console.log(`Content of the latest email: \n${body}`);
        return body; // Return email content
    } else {
        console.log('Failed to get email content.');
        return null;
    }
}

/**
 * Function to get text content of an email
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


