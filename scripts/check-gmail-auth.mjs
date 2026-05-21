import { promises as fs } from "fs";
import { google } from "googleapis";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), "config", "token.json");
const TIMEOUT_MS = 30_000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms (${label})`)), ms)
    ),
  ]);
}

const start = Date.now();
try {
  const raw = await fs.readFile(TOKEN_PATH, "utf8");
  const creds = JSON.parse(raw);
  console.log("token.json keys:", Object.keys(creds));
  console.log("has refresh_token:", Boolean(creds.refresh_token));

  const client = google.auth.fromJSON(creds);
  const tokenResp = await withTimeout(
    client.getAccessToken(),
    TIMEOUT_MS,
    "getAccessToken"
  );
  console.log(
    "getAccessToken OK — token length:",
    tokenResp?.token ? tokenResp.token.length : 0
  );

  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await withTimeout(
    gmail.users.getProfile({ userId: "me" }),
    TIMEOUT_MS,
    "gmail.users.getProfile"
  );
  console.log("gmail profile email:", profile.data.emailAddress);
  console.log(`OK (${Date.now() - start}ms)`);
  process.exit(0);
} catch (err) {
  console.error(`FAIL (${Date.now() - start}ms):`, err?.message || err);
  process.exit(1);
}
