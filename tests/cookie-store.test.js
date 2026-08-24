import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  cookiesForUrl,
  getCookieFilePath,
  getCookieHeader,
  loadCookieJar,
  validateCookieJar,
  writeCookieJar,
} from "../utils/cookieStore.js";
import { loginFnAuto } from "../utils/FieldNation/loginFnAuto.js";
import { loginWMAuto } from "../utils/WorkMarket/loginWMAuto.js";

function wmCookies(value = "session-one") {
  return [
    {
      name: "CSRFToken",
      value: "csrf-token",
      domain: ".workmarket.com",
      path: "/",
      secure: true,
      expires: -1,
    },
    {
      name: "workmarketSessionId",
      value,
      domain: ".workmarket.com",
      path: "/",
      secure: true,
      expires: -1,
    },
  ];
}

test("cookie validation rejects jars without recognized session cookies", () => {
  assert.throws(
    () => validateCookieJar([{ name: "analytics", value: "1" }], "WorkMarket"),
    /no recognized session cookies/
  );
});

test("cookie URL scoping excludes expired, cross-domain, and secure HTTP cookies", () => {
  const nowMs = Date.UTC(2026, 7, 23);
  const cookies = [
    ...wmCookies(),
    { name: "expired", value: "x", expires: nowMs / 1000 - 1 },
    { name: "other", value: "x", domain: ".example.com", path: "/" },
    { name: "details", value: "x", domain: ".workmarket.com", path: "/assignments" },
  ];

  const httpsNames = cookiesForUrl(
    cookies,
    "https://www.workmarket.com/assignments/details/1",
    nowMs
  ).map(cookie => cookie.name);
  assert.deepEqual(httpsNames, ["CSRFToken", "workmarketSessionId", "details"]);

  const httpNames = cookiesForUrl(
    cookies,
    "http://www.workmarket.com/assignments/details/1",
    nowMs
  ).map(cookie => cookie.name);
  assert.deepEqual(httpNames, ["details"]);
});

test("atomic writes preserve the known-good jar after a rejected replacement", async t => {
  const baseDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "fn-cookie-store-")
  );
  t.after(() => fs.promises.rm(baseDirectory, { recursive: true, force: true }));

  await writeCookieJar("WorkMarket", wmCookies("known-good"), {
    baseDirectory,
  });

  await assert.rejects(
    writeCookieJar("WorkMarket", [{ name: "analytics", value: "bad" }], {
      baseDirectory,
    }),
    /no recognized session cookies/
  );

  const loaded = loadCookieJar("WorkMarket", { baseDirectory });
  assert.equal(
    loaded.find(cookie => cookie.name === "workmarketSessionId")?.value,
    "known-good"
  );
});

test("atomic writes replace an existing jar and leave no staging files", async t => {
  const baseDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "fn-cookie-store-")
  );
  t.after(() => fs.promises.rm(baseDirectory, { recursive: true, force: true }));

  await writeCookieJar("WorkMarket", wmCookies("old"), { baseDirectory });
  await writeCookieJar("WorkMarket", wmCookies("new"), { baseDirectory });

  const header = getCookieHeader(
    "WorkMarket",
    "https://www.workmarket.com/assignments/1",
    { baseDirectory }
  );
  assert.match(header, /workmarketSessionId=new/);

  const directory = path.dirname(
    getCookieFilePath("WorkMarket", undefined, baseDirectory)
  );
  const stagedFiles = (await fs.promises.readdir(directory)).filter(name =>
    name.endsWith(".tmp")
  );
  assert.deepEqual(stagedFiles, []);
});

test("loader skips an invalid primary jar and uses the valid legacy fallback", async t => {
  const baseDirectory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "fn-cookie-store-")
  );
  t.after(() => fs.promises.rm(baseDirectory, { recursive: true, force: true }));

  await writeCookieJar("WorkMarket", wmCookies("fallback"), {
    baseDirectory,
    filename: "cookies.json",
  });
  const primary = getCookieFilePath(
    "WorkMarket",
    "autoCookies.json",
    baseDirectory
  );
  await fs.promises.writeFile(primary, "not-json", "utf8");

  const loaded = loadCookieJar("WorkMarket", { baseDirectory });
  assert.equal(
    loaded.find(cookie => cookie.name === "workmarketSessionId")?.value,
    "fallback"
  );
});

test("automated logins require environment credentials before opening a page", async () => {
  const original = {
    FN_EMAIL: process.env.FN_EMAIL,
    FN_PASSWORD: process.env.FN_PASSWORD,
    WM_EMAIL: process.env.WM_EMAIL,
    WM_PASSWORD: process.env.WM_PASSWORD,
  };
  delete process.env.FN_EMAIL;
  delete process.env.FN_PASSWORD;
  delete process.env.WM_EMAIL;
  delete process.env.WM_PASSWORD;

  const browser = {
    newPage() {
      throw new Error("browser should not be opened without credentials");
    },
  };

  try {
    const [fnResult, wmResult] = await Promise.all([
      loginFnAuto(browser),
      loginWMAuto(browser),
    ]);
    assert.equal(fnResult.success, false);
    assert.match(fnResult.error, /environment variables are required/);
    assert.equal(wmResult.success, false);
    assert.match(wmResult.error, /environment variables are required/);
  } finally {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
