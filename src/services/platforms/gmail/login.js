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

function loadEnvCredentials() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  const redirectUri = process.env.GMAIL_REDIRECT_URI || "http://localhost";
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

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
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload); // Зберігаємо токен у файлі
}

/**
 * Завантаження або запит авторизації для виклику API.
 *
 */
export async function authorize() {
  const envClient = loadEnvCredentials();
  if (envClient) {
    try {
      await envClient.getAccessToken();
      return envClient;
    } catch (error) {
      console.log("Env OAuth token invalid, falling back to local auth.");
    }
  }

  let client = await loadSavedCredentialsIfExist();

  // Якщо є збережені облікові дані, перевіряємо їх дійсність
  if (client) {
    try {
      // Викликаємо getAccessToken для перевірки чи токен ще дійсний
      await client.getAccessToken();
      return client;
    } catch (error) {
      console.log(
        "Токен не дійсний або прострочений, ініціюємо нову авторизацію."
      );
    }
  }

  // Якщо немає збережених даних або вони прострочені, авторизуємось знову
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  if (client.credentials) {
    await saveCredentials(client); // Зберігаємо новий refresh token
  }

  return client;
}
