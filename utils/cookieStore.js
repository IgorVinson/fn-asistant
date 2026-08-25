import fs from "fs";
import path from "path";

const PLATFORM_CONFIG = Object.freeze({
  FieldNation: {
    primary: "cookies.json",
    fallbacks: [],
    targetUrl: "https://app.fieldnation.com/",
    hasSessionCookie: names =>
      names.has("FNSESS") ||
      names.has("fnsid") ||
      [...names].some(name => name.startsWith("ambassador_session.")),
  },
  WorkMarket: {
    primary: "autoCookies.json",
    fallbacks: ["cookies.json"],
    targetUrl: "https://www.workmarket.com/",
    hasSessionCookie: names =>
      names.has("CSRFToken") &&
      (names.has("workmarketSessionId") || names.has("JSESSIONID")),
  },
});

function getPlatformConfig(platform) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) throw new Error(`Unsupported cookie platform: ${platform}`);
  return config;
}

function assertSafeFilename(filename) {
  if (
    typeof filename !== "string" ||
    !filename.endsWith(".json") ||
    path.basename(filename) !== filename
  ) {
    throw new Error(`Unsafe cookie filename: ${filename}`);
  }
}

export function getCookieFilePath(
  platform,
  filename,
  baseDirectory = process.cwd()
) {
  const config = getPlatformConfig(platform);
  const resolvedFilename = filename || config.primary;
  assertSafeFilename(resolvedFilename);
  return path.resolve(baseDirectory, "utils", platform, resolvedFilename);
}

function isExpired(cookie, nowSeconds) {
  return (
    Number.isFinite(cookie.expires) &&
    cookie.expires > 0 &&
    cookie.expires <= nowSeconds
  );
}

export function validateCookieJar(cookies, platform, options = {}) {
  const config = getPlatformConfig(platform);
  if (!Array.isArray(cookies)) {
    throw new Error(`${platform} cookie jar must be an array`);
  }

  const nowSeconds = (options.nowMs ?? Date.now()) / 1000;
  const validCookies = cookies.filter(
    cookie =>
      cookie &&
      typeof cookie.name === "string" &&
      cookie.name.length > 0 &&
      typeof cookie.value === "string" &&
      !isExpired(cookie, nowSeconds)
  );

  if (validCookies.length === 0) {
    throw new Error(`${platform} cookie jar contains no usable cookies`);
  }

  if (options.requireSession !== false) {
    const targetUrl = options.targetUrl || config.targetUrl;
    const scopedCookies = cookiesForUrl(validCookies, targetUrl, options.nowMs);
    const names = new Set(scopedCookies.map(cookie => cookie.name));
    if (!config.hasSessionCookie(names)) {
      throw new Error(
        `${platform} cookie jar has no recognized session cookies valid for ${new URL(targetUrl).hostname}`
      );
    }
  }

  return validCookies;
}

function domainMatches(hostname, cookieDomain) {
  if (!cookieDomain) return true;
  const domain = cookieDomain.replace(/^\./, "").toLowerCase();
  const host = hostname.toLowerCase();
  return host === domain || host.endsWith(`.${domain}`);
}

function pathMatches(requestPath, cookiePath = "/") {
  if (requestPath === cookiePath) return true;
  const prefix = cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`;
  return requestPath.startsWith(prefix);
}

export function cookiesForUrl(cookies, targetUrl, nowMs = Date.now()) {
  const url = new URL(targetUrl);
  const nowSeconds = nowMs / 1000;
  return cookies.filter(
    cookie =>
      !isExpired(cookie, nowSeconds) &&
      domainMatches(url.hostname, cookie.domain) &&
      pathMatches(url.pathname || "/", cookie.path || "/") &&
      (!cookie.secure || url.protocol === "https:")
  );
}

function readCookieJarFile(filePath, platform, options = {}) {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return validateCookieJar(parsed, platform, options);
}

export function loadCookieJar(platform, options = {}) {
  const config = getPlatformConfig(platform);
  const filenames = options.filename
    ? [options.filename]
    : [config.primary, ...config.fallbacks];
  const errors = [];

  for (const filename of filenames) {
    const filePath = getCookieFilePath(
      platform,
      filename,
      options.baseDirectory
    );
    if (!fs.existsSync(filePath)) continue;
    try {
      return readCookieJarFile(filePath, platform, options);
    } catch (error) {
      errors.push(`${filename}: ${error.message}`);
    }
  }

  const detail = errors.length ? ` (${errors.join("; ")})` : "";
  throw new Error(`${platform} cookies are unavailable${detail}`);
}

export function getCookieHeader(platform, targetUrl, options = {}) {
  const config = getPlatformConfig(platform);
  const cookies = loadCookieJar(platform, options);
  const scoped = cookiesForUrl(cookies, targetUrl || config.targetUrl);
  if (scoped.length === 0) {
    throw new Error(`${platform} has no cookies valid for the requested URL`);
  }
  return scoped.map(cookie => `${cookie.name}=${cookie.value}`).join("; ");
}

export async function writeCookieJar(platform, cookies, options = {}) {
  const validCookies = validateCookieJar(cookies, platform, options);
  const filePath = getCookieFilePath(
    platform,
    options.filename,
    options.baseDirectory
  );
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  await fs.promises.mkdir(directory, { recursive: true });
  try {
    await fs.promises.writeFile(
      temporaryPath,
      `${JSON.stringify(validCookies, null, 2)}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 }
    );
    readCookieJarFile(temporaryPath, platform, options);
    await fs.promises.rename(temporaryPath, filePath);
    await fs.promises.chmod(filePath, 0o600).catch(() => {});
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }

  return { filePath, cookieCount: validCookies.length };
}

export async function savePageCookies(page, platform, options = {}) {
  if (!page || page.isClosed()) {
    throw new Error(`Cannot save ${platform} cookies from a closed page`);
  }
  return writeCookieJar(platform, await page.cookies(), options);
}
