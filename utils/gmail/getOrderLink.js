import { log } from 'console';

/**
 * Функція для отримання посилання на замовлення з вмісту останнього листа
 * @param {string} emailBody - Текстовий вміст листа
 * @returns {string|null} - Посилання на замовлення або null, якщо не знайдено
 */
export function getOrderLink(emailBody) {
  // Try WorkMarket patterns
  const workMarketPatterns = [
    // Direct work order link
    /https:\/\/www\.workmarket\.com\/assignments\/details\/\d+/,
    // SendGrid redirect link
    /https?:\/\/sendgrid\.workmarket\.com\/uni\/ls\/click\?upn=[^"'\s]+/,
  ];

  for (const pattern of workMarketPatterns) {
    const match = emailBody.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // Try FieldNation patterns
  const fieldNationPatterns = [
    // Direct work order link (singular and plural forms)
    /https:\/\/app\.fieldnation\.com\/workorder\/(\d+)/,
    /https:\/\/app\.fieldnation\.com\/workorders\/(\d+)/,
    // Link from email
    /https:\/\/[^\/]+\.fieldnation\.com\/\?.*?workorder(?:_id)?=(\d+)/,
    // Notification link
    /https:\/\/app\.fieldnation\.com\/notifications\/workorder\/(\d+)/,
  ];

  for (const pattern of fieldNationPatterns) {
    const match = emailBody.match(pattern);
    if (match) {
      // If it's a notification or email link, convert to direct work order URL
      return `https://app.fieldnation.com/workorder/${match[1]}`;
    }
  }

  // Log the first 200 chars of email for debugging
  console.log(
    'No work order link found in email body:',
    emailBody.substring(0, 200)
  );
  return null;
}
