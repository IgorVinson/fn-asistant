import { authenticate } from "@google-cloud/local-auth";
import { promises as fs } from "fs";
import { google } from "googleapis";
import path from "path";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];
const TOKEN_PATH = path.join(process.cwd(), "config", "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "config", "credentials.json");

let cachedAuthClientPromise = null;

/**
 * Читання збережених раніше авторизованих облікових даних.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null; // Якщо немає збережених облікових даних
  }
}

/**
 * Серіалізація облікових даних до файлу, сумісного з GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const existingCredentials = await readSavedCredentials();
  const refreshToken =
    client.credentials.refresh_token || existingCredentials?.refresh_token;

  if (!refreshToken) {
    throw new Error("Cannot save Google credentials without a refresh token");
  }

  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: refreshToken,
  });
  await fs.writeFile(TOKEN_PATH, payload); // Зберігаємо токен у файлі
}

async function readSavedCredentials() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

/**
 * Завантаження або запит авторизації для виклику API.
 *
 */
export async function authorize() {
  if (cachedAuthClientPromise) {
    return cachedAuthClientPromise;
  }

  cachedAuthClientPromise = authorizeUncached().catch(error => {
    cachedAuthClientPromise = null;
    throw error;
  });

  return cachedAuthClientPromise;
}

const ACCESS_TOKEN_TIMEOUT_MS = 30_000;
const INTERACTIVE_AUTH_ALLOWED =
  process.env.GMAIL_ALLOW_INTERACTIVE_AUTH === "1";

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gmail auth timeout after ${ms}ms (${label})`)),
        ms
      )
    ),
  ]);
}

async function authorizeUncached() {
  let client = await loadSavedCredentialsIfExist();

  if (client) {
    try {
      await withTimeout(
        client.getAccessToken(),
        ACCESS_TOKEN_TIMEOUT_MS,
        "getAccessToken"
      );
      return client;
    } catch (error) {
      console.log(
        `Токен не дійсний або прострочений: ${error.message}`
      );
    }
  }

  if (!INTERACTIVE_AUTH_ALLOWED) {
    throw new Error(
      "Gmail refresh token is invalid or missing. Re-auth required: run `GMAIL_ALLOW_INTERACTIVE_AUTH=1 node utils/gmail/script.js` interactively to refresh config/token.json."
    );
  }

  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    await saveCredentials(client);
  }

  return client;
}
