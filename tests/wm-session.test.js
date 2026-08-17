import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { inspectWMBody, isAuthenticatedWMBody } from "../utils/WorkMarket/wmSession.js";

const fixture = name =>
  fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", name), "utf-8");

// Regression: on 2026-08-12 an expired WorkMarket session started answering
// assignment URLs with a contentless Next.js shell instead of a login page.
// The old check looked for "login?redirectTo=" / "Please sign in", matched
// neither, so authExpired stayed false and every order was silently dropped as
// an "unavailable ticket" — no re-login, no retry, no log line.
test("the bare SPA shell is treated as an expired session, not a live page", () => {
  const body = fixture("wm-spa-shell.html");

  // Guard the premise: this is exactly why the old detection failed.
  assert.ok(!body.includes("login?redirectTo="), "shell has no login redirect marker");
  assert.ok(!body.includes("Please sign in"), "shell has no sign-in marker");

  const result = inspectWMBody(body, "9940748941");
  assert.equal(result.ok, false);
  assert.match(result.reason, /shell/i);
});

test("a real authenticated assignment page is accepted", () => {
  const body = fixture("wm-authenticated.html");

  assert.equal(isAuthenticatedWMBody(body, "1619477030"), true);
  assert.equal(inspectWMBody(body, "").ok, true, "marker alone is enough");
});

test("the classic server-rendered login wall is still detected", () => {
  const body = `<html><body>Please sign in to continue</body></html>`;
  const result = inspectWMBody(body, "123");

  assert.equal(result.ok, false);
  assert.match(result.reason, /login wall/i);
});

test("an empty body is an expired session, not a valid page", () => {
  assert.equal(inspectWMBody("", "123").ok, false);
  assert.equal(inspectWMBody(undefined, "123").ok, false);
});

test("a page mentioning only the work order id counts as authenticated", () => {
  const body = `<html><body><div data-order="9940748941">details</div></body></html>`;
  assert.equal(isAuthenticatedWMBody(body, "9940748941"), true);
});

// getWMorderData must classify these two failures differently: a dead session
// has to trigger a re-login, an unavailable ticket must NOT (or every taken
// ticket would kick off a full 2FA login).
test("getWMorderData distinguishes a dead session from an unavailable ticket", async t => {
  const { getWMorderData } = await import("../utils/WorkMarket/getWMorderData.js");
  const realFetch = global.fetch;

  const stubFetch = pageBody => async url => {
    const href = String(url);
    // First hop is deliberately cookie-less and always lands on /login.
    if (href.includes("sendgrid")) {
      return {
        ok: true,
        url: "https://www.workmarket.com/login?redirectTo=/assignments/details/9940748941",
        text: async () => "",
      };
    }
    return { ok: true, url: href, text: async () => pageBody };
  };

  t.after(() => {
    global.fetch = realFetch;
  });

  const link = "http://sendgrid.workmarket.com/uni/ls/click?upn=test";

  global.fetch = stubFetch(fixture("wm-spa-shell.html"));
  const dead = await getWMorderData(link);
  assert.equal(dead.authExpired, true, "SPA shell must request a re-login");
  assert.equal(dead.id, "9940748941");

  global.fetch = stubFetch(
    "<html><body>This assignment is no longer available</body></html>"
  );
  const gone = await getWMorderData(link);
  assert.equal(gone.authExpired, false, "dead ticket must NOT trigger re-login");

  global.fetch = stubFetch(fixture("wm-authenticated.html"));
  const live = await getWMorderData(link);
  assert.equal(live.authExpired, undefined, "a good page is not a skeleton");
  assert.equal(live.company, "Granite Telecommunications");
});

test("an unknown work order id is never used as proof of content", () => {
  // getInvalidDataSkeleton defaults the id to "unknown"; if that string were
  // matched against the body it could mask a dead session.
  const body = `<html><body>unknown</body></html>`;
  assert.equal(isAuthenticatedWMBody(body, "unknown"), false);
});
