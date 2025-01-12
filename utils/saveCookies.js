import path from "path";
import fs from "fs";

export async function saveCookies(page,platform) {
    const cookiesFilePath = path.resolve(process.cwd(), 'utils', platform, 'cookies.json');

    if (fs.existsSync(cookiesFilePath)) {
        fs.unlinkSync(cookiesFilePath); // Видаляємо старий файл
        console.log('Старий файл куків видалено.');
    }

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2)); // Записуємо нові куки
    console.log('Новий файл куків збережено.');
}

