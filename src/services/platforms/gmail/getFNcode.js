import { google } from 'googleapis';

/**
 * Get the Field Nation verification code from the latest email from donotreply@fieldnation.com
 *
 * @param {OAuth2Client} auth An authorized OAuth2 client.
 * @returns {Promise<string|null>} - The 6-digit verification code or null if not found
 */
export async function getFNcode(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    try {
        // Search for emails from Field Nation with verification code
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'from:donotreply@fieldnation.com "Your Verification Code"',
            maxResults: 1, // Get only the most recent email
        });

        const messages = res.data.messages;

        if (!messages || messages.length === 0) {
            console.log('❌ No Field Nation verification emails found.');
            return null;
        }

        // Get email details by its ID
        const messageId = messages[0].id;
        const msg = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
        });

        // Get email text content
        const body = getMessageBody(msg.data.payload);

        if (body) {
            // Extract the 6-digit verification code
            const code = extractVerificationCode(body);
            
            if (code) {
                console.log(`✅ Found verification code: ${code}`);
                return code;
            } else {
                console.log('❌ Verification code not found in email content.');
                console.log('Email content:', body);
                return null;
            }
        } else {
            console.log('❌ Failed to get email content.');
            return null;
        }
    } catch (error) {
        console.error('❌ Error getting Field Nation verification code:', error);
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
            } else if (part.mimeType === 'text/html' && part.body.data && !body) {
                // Fallback to HTML if plain text is not available
                body = Buffer.from(part.body.data, 'base64').toString('utf8');
            }
        }
    } else if (payload.body && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return body ? body : null;
}

/**
 * Extract 6-digit verification code from email content
 * @param {string} emailContent 
 * @returns {string|null}
 */
function extractVerificationCode(emailContent) {
    // Look for patterns like:
    // "Your Verification Code\n239690"
    // "Your Verification Code: 239690"
    // "Verification Code\n239690"
    
    const patterns = [
        /Your Verification Code[\s\n\r]*(\d{6})/i,
        /Verification Code[\s\n\r:]*(\d{6})/i,
        /verification code[\s\n\r:]*is[\s\n\r]*(\d{6})/i,
        /code[\s\n\r:]*(\d{6})/i,
        /(\d{6})/g // Last resort: any 6-digit number
    ];

    for (const pattern of patterns) {
        const match = emailContent.match(pattern);
        if (match && match[1]) {
            // Validate it's exactly 6 digits
            if (/^\d{6}$/.test(match[1])) {
                return match[1];
            }
        }
    }

    return null;
}

/**
 * Wait for a new Field Nation verification email to arrive
 * @param {OAuth2Client} auth An authorized OAuth2 client.
 * @param {number} timeoutMs Maximum time to wait in milliseconds (default: 60000 = 1 minute)
 * @param {number} intervalMs Check interval in milliseconds (default: 3000 = 3 seconds)
 * @returns {Promise<string|null>} - The verification code or null if timeout
 */
export async function waitForFNcode(auth, timeoutMs = 60000, intervalMs = 3000) {
    const gmail = google.gmail({ version: 'v1', auth });
    console.log('⏳ Waiting for Field Nation verification email...');
    
    // Wait at least 5-10 seconds before starting to check for new emails
    console.log('⏰ Waiting 8 seconds for email to arrive...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
        try {
            // Search for very recent emails from Field Nation (within last 2 minutes)
            const res = await gmail.users.messages.list({
                userId: 'me',
                labelIds: ['INBOX'],
                q: 'from:donotreply@fieldnation.com "Your Verification Code" newer_than:2m',
                maxResults: 3, // Check last 3 emails to be safe
            });

            const messages = res.data.messages;

            if (messages && messages.length > 0) {
                console.log(`🔍 Found ${messages.length} recent Field Nation email(s), checking for verification code...`);
                
                // Check each message for the verification code
                for (const message of messages) {
                    const msg = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                    });

                    // Get email content
                    const body = getMessageBody(msg.data.payload);
                    
                    if (body) {
                        // Extract the verification code using regex
                        const code = extractVerificationCode(body);
                        
                        if (code) {
                            console.log(`✅ Found verification code: ${code}`);
                            return code;
                        }
                    }
                }
            }

            // Wait before checking again
            console.log(`⏳ No verification code found yet, waiting ${intervalMs/1000} seconds before next check...`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            
        } catch (error) {
            console.error('❌ Error checking for verification email:', error);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
    
    console.log('\n⏰ Timeout: No verification email received within the time limit.');
    return null;
}
