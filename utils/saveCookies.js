import { savePageCookies } from "./cookieStore.js";

/**
 * Save cookies to a file
 */
export async function saveCookies(page, platform) {
  const result = await savePageCookies(page, platform);
  console.log(`✓ Saved ${result.cookieCount} ${platform} cookies atomically`);
  return result;
}

/**
 * Save cookies with a custom filename
 */
export async function saveCookiesCustom(page, platform, filename) {
  const result = await savePageCookies(page, platform, { filename });
  console.log(
    `✓ Saved ${result.cookieCount} ${platform} cookies atomically to ${filename}`
  );
  return result;
}
