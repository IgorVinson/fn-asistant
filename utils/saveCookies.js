import fs from "fs";
import path from "path";

export async function saveCookies(page, platform) {
  const cookiesFilePath = path.resolve(
    process.cwd(),
    "utils",
    platform,
    "cookies.json"
  );

  if (fs.existsSync(cookiesFilePath)) {
    fs.unlinkSync(cookiesFilePath); // Видаляємо старий файл
    console.log("Старий файл куків видалено.");
  }

  const cookies = await page.cookies();
  fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2)); // Записуємо нові куки
  console.log("Новий файл куків збережено.");
}

/**
 * Save cookies with a custom filename
 * @param {Object} page - Puppeteer page instance
 * @param {string} platform - Platform name (folder name)
 * @param {string} filename - Custom filename (e.g., 'autoCookies.json')
 */
export async function saveCookiesCustom(page, platform, filename) {
  const cookiesFilePath = path.resolve(
    process.cwd(),
    "utils",
    platform,
    filename
  );

  if (fs.existsSync(cookiesFilePath)) {
    fs.unlinkSync(cookiesFilePath); // Видаляємо старий файл
    console.log(`Старий файл куків ${filename} видалено.`);
  }

  const cookies = await page.cookies();
  fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2)); // Записуємо нові куки
  console.log(`✅ Куки збережено в ${filename}`);
}
