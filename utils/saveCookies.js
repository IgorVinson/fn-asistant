import fs from "fs";
import path from "path";

/**
 * Save cookies to a file
 */
export async function saveCookies(page, platform) {
  const cookiesFilePath = path.resolve(
    process.cwd(),
    "utils",
    platform,
    "cookies.json"
  );

  try {
    if (fs.existsSync(cookiesFilePath)) {
      fs.unlinkSync(cookiesFilePath); // Remove old cookie file
      console.log("✓ Old cookie file removed.");
    }

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2));
    console.log("✓ Cookies saved to cookies.json");
  } catch (error) {
    console.error("✗ Failed to save cookies:", error.message);

    // Try fallback location
    try {
      const fallbackPath = path.resolve(process.cwd(), "utils", platform, "fallback-cookies.json");
      const cookies = await page.cookies();
      fs.writeFileSync(fallbackPath, JSON.stringify(cookies, null, 2));
      console.log("✓ Cookies saved to fallback-cookies.json");
    } catch (fallbackError) {
      console.error("✗ Failed to save cookies to fallback location:", fallbackError.message);
    }
  }
}

/**
 * Save cookies with a custom filename
 */
export async function saveCookiesCustom(page, platform, filename) {
  const cookiesFilePath = path.resolve(
    process.cwd(),
    "utils",
    platform,
    filename
  );

  try {
    if (fs.existsSync(cookiesFilePath)) {
      fs.unlinkSync(cookiesFilePath);
      console.log(`✓ Old cookie file ${filename} removed.`);
    }

    const cookies = await page.cookies();
    fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies, null, 2));
    console.log(`✓ Cookies saved to ${filename}`);
  } catch (error) {
    console.error(`✗ Failed to save cookies to ${filename}:`, error.message);

    // Try fallback location
    try {
      const fallbackPath = path.resolve(
        process.cwd(),
        "utils",
        platform,
        "fallback-cookies.json"
      );
      const cookies = await page.cookies();
      fs.writeFileSync(fallbackPath, JSON.stringify(cookies, null, 2));
      console.log(`✓ Cookies saved to fallback-cookies.json`);
    } catch (fallbackError) {
      console.error(`✗ Failed to save cookies to fallback location:`, fallbackError.message);
    }
  }
}
