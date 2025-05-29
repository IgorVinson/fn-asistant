import { google } from 'googleapis';

/**
 * Get the WorkMarket verification code from the latest email from hi@myworkmarket.com
 *
 * @param {OAuth2Client} auth An authorized OAuth2 client.
 * @returns {Promise<string|null>} - The 6-digit verification code or null if not found
 */
export async function getWMcode(auth) {
    const gmail = google.gmail({ version: 'v1', auth });

    try {
        // Search for emails from WorkMarket with verification code
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: 'from:hi@myworkmarket.com "WorkMarket requires you to enter a code"',
            maxResults: 1, // Get only the most recent email
        });

        const messages = res.data.messages;

        if (!messages || messages.length === 0) {
            console.log('❌ No WorkMarket verification emails found.');
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
        console.error('❌ Error getting WorkMarket verification code:', error);
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
 * Extract 6-digit verification code from WorkMarket email content
 * @param {string} emailContent 
 * @returns {string|null}
 */
function extractVerificationCode(emailContent) {
    console.log("🔍 Extracting verification code from email content...");
    
    // First, let's strip HTML tags to get clean text
    const cleanText = emailContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log("🧹 Cleaned text:", cleanText.substring(0, 500));
    
    // Look for patterns in WorkMarket emails:
    const patterns = [
        // HTML patterns (for when HTML is not stripped)
        /<p[^>]*>\s*(\d{6})\s*<\/p>/i, // HTML paragraph with 6-digit code
        /letter-spacing[^>]*>\s*(\d{6})\s*<\/p>/i, // Specific HTML pattern from WorkMarket
        
        // Text patterns
        /enter.*code.*below.*?(\d{6})/i, // Pattern around "enter the code provided below"
        /verification.*?(\d{6})/i,
        /verify.*?(\d{6})/i,
        /code.*?(\d{6})/i,
        
        // Standalone 6-digit patterns (more specific first)
        /WorkMarket.*?(\d{6})/i, // After "WorkMarket" mention
        /(\d{6})\s*Thank you/i, // Before "Thank you"
        /(\d{6})\s*WorkMarket/i, // Before "WorkMarket" mention
        
        // Last resort: any 6-digit number, but validate it's not part of other numbers
        /(?<!\d)(\d{6})(?!\d)/g // 6 digits not surrounded by other digits
    ];

    // Try patterns on original HTML content first
    console.log("🔍 Trying patterns on HTML content...");
    for (const pattern of patterns) {
        const match = emailContent.match(pattern);
        if (match && match[1]) {
            // Validate it's exactly 6 digits
            if (/^\d{6}$/.test(match[1])) {
                console.log(`✅ Found code with HTML pattern: ${match[1]}`);
                return match[1];
            }
        }
    }
    
    // Try patterns on cleaned text
    console.log("🔍 Trying patterns on cleaned text...");
    for (const pattern of patterns) {
        const match = cleanText.match(pattern);
        if (match && match[1]) {
            // Validate it's exactly 6 digits
            if (/^\d{6}$/.test(match[1])) {
                console.log(`✅ Found code with text pattern: ${match[1]}`);
                return match[1];
            }
        }
    }
    
    // Final attempt: find any 6-digit sequences and validate context
    const sixDigitMatches = emailContent.match(/\d{6}/g);
    if (sixDigitMatches) {
        console.log("🔍 Found 6-digit sequences:", sixDigitMatches);
        // Return the first 6-digit sequence as WorkMarket codes are typically the main content
        for (const code of sixDigitMatches) {
            // Simple validation: avoid obvious non-codes (like years, phone numbers etc)
            if (!emailContent.includes(`${code}px`) && // Not CSS pixel values
                !emailContent.includes(`${code}%`) &&  // Not percentages
                !emailContent.includes(`${code}pt`)) { // Not font sizes
                console.log(`✅ Found valid 6-digit code: ${code}`);
                return code;
            }
        }
    }

    console.log("❌ No verification code found in email");
    return null;
}

/**
 * Wait for a new WorkMarket verification email to arrive
 * @param {OAuth2Client} auth An authorized OAuth2 client.
 * @param {number} timeoutMs Maximum time to wait in milliseconds (default: 60000 = 1 minute)
 * @param {number} intervalMs Check interval in milliseconds (default: 3000 = 3 seconds)
 * @returns {Promise<string|null>} - The verification code or null if timeout
 */
export async function waitForWMcode(auth, timeoutMs = 60000, intervalMs = 3000) {
    const gmail = google.gmail({ version: 'v1', auth });
    console.log('⏳ Waiting for WorkMarket verification email...');
    
    // Wait at least 5-10 seconds before starting to check for new emails
    console.log('⏰ Waiting 8 seconds for email to arrive...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
        try {
            // Search for very recent emails from WorkMarket (within last 2 minutes)
            const res = await gmail.users.messages.list({
                userId: 'me',
                labelIds: ['INBOX'],
                q: 'from:hi@myworkmarket.com "WorkMarket requires you to enter a code" newer_than:2m',
                maxResults: 3, // Check last 3 emails to be safe
            });

            const messages = res.data.messages;

            if (messages && messages.length > 0) {
                console.log(`🔍 Found ${messages.length} recent WorkMarket email(s), checking for verification code...`);
                
                // Check each message for the verification code
                for (const message of messages) {
                    const msg = await gmail.users.messages.get({
                        userId: 'me',
                        id: message.id,
                    });

                    // Get email content
                    const body = getMessageBody(msg.data.payload);
                    
                    console.log(`📧 Checking email ID: ${message.id}`);
                    console.log(`📧 Email subject: ${msg.data.payload.headers?.find(h => h.name === 'Subject')?.value || 'No subject'}`);
                    console.log(`📧 Email content preview: ${body?.substring(0, 200) || 'No content'}...`);
                    
                    if (body) {
                        // Extract the verification code using regex
                        const code = extractVerificationCode(body);
                        
                        if (code) {
                            console.log(`✅ Found verification code: ${code}`);
                            return code;
                        } else {
                            console.log('❌ No verification code found in this email');
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
