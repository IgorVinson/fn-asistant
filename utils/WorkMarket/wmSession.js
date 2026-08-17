import fs from "fs";
import path from "path";
import logger from "../logger.js";
import { CONFIG } from "../../config.js";

const cookiesFilePath = path.resolve("utils", "WorkMarket", "autoCookies.json");
const PROBE_URL = "https://www.workmarket.com/assignments";

// A real, authenticated WorkMarket assignment page is server-rendered and always
// carries at least one of these. The logged-out response carries none of them.
const ASSIGNMENT_MARKERS = [
  "companyName:",
  "assignment-header",
  "/profile/company/",
];

// Explicit "you are logged out" tells. The first two are the classic
// server-rendered login wall; the third is the modern behaviour, where
// WorkMarket answers any unauthenticated deep link with the bare Next.js
// ("squirtle") shell for the site root instead of a login page.
const LOGGED_OUT_MARKERS = ["login?redirectTo=", "Please sign in"];

function looksLikeBareSpaShell(body) {
  // The shell is the Next.js document for the index route: it advertises
  // __NEXT_DATA__ with page "/" and contains no server-rendered content.
  // A genuine assignment page has no __NEXT_DATA__ block at all.
  if (!body.includes("__NEXT_DATA__")) return false;
  return /"page"\s*:\s*"\/"/.test(body) || !/"page"\s*:\s*"[^"]+"/.test(body);
}

/**
 * Decide whether a fetched WorkMarket body came back authenticated.
 *
 * Deliberately a POSITIVE-signal check: we require proof that real assignment
 * content is present, rather than searching for logged-out marker strings.
 * WorkMarket changed its logged-out response to a contentless SPA shell that
 * matched none of the old markers, which made every expired session look like
 * an "unavailable ticket" and silently dropped the order.
 *
 * @param {string} body            raw HTML from the assignment fetch
 * @param {string|number} expectedWorkOrderId  id the page should mention
 * @returns {{ok: boolean, reason: string}} ok=true means the session is alive
 */
export function inspectWMBody(body, expectedWorkOrderId = "") {
  if (typeof body !== "string" || body.trim() === "") {
    return { ok: false, reason: "empty response body" };
  }

  const loggedOutMarker = LOGGED_OUT_MARKERS.find(marker =>
    body.includes(marker)
  );
  if (loggedOutMarker) {
    return { ok: false, reason: `login wall detected ("${loggedOutMarker}")` };
  }

  if (looksLikeBareSpaShell(body)) {
    return {
      ok: false,
      reason: "received the bare SPA shell (no server-rendered content)",
    };
  }

  const marker = ASSIGNMENT_MARKERS.find(m => body.includes(m));
  if (marker) return { ok: true, reason: `assignment marker "${marker}"` };

  const id = String(expectedWorkOrderId || "");
  if (id && id !== "unknown" && body.includes(id)) {
    return { ok: true, reason: `work order id ${id} present` };
  }

  // Fail closed: no proof of content means we assume the session is gone.
  // A genuinely unavailable ticket is caught earlier by its own markers, and
  // the re-login cooldown in index.js stops this from becoming a 2FA loop.
  return { ok: false, reason: "no assignment content found in response" };
}

/** Thin boolean wrapper around {@link inspectWMBody}. */
export function isAuthenticatedWMBody(body, expectedWorkOrderId = "") {
  return inspectWMBody(body, expectedWorkOrderId).ok;
}

function getCookieHeader() {
  try {
    if (!fs.existsSync(cookiesFilePath)) return null;
    const cookiesJson = JSON.parse(fs.readFileSync(cookiesFilePath, "utf-8"));
    if (!Array.isArray(cookiesJson)) return null;

    const cookies = cookiesJson
      .filter(
        cookie =>
          typeof cookie.name === "string" && typeof cookie.value === "string"
      )
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join("; ");

    return cookies || null;
  } catch (error) {
    logger.error(`Probe could not read cookies: ${error.message}`, "WorkMarket");
    return null;
  }
}

/**
 * Cheap authenticated GET used to notice an expired session BETWEEN orders,
 * rather than during one. Mirrors the cookie/header pattern in
 * getWMAssignments.js so WorkMarket sees a consistent client.
 *
 * @returns {Promise<{ok: boolean, reason: string}>}
 */
export async function probeWMSession() {
  const cookies = getCookieHeader();
  if (!cookies) return { ok: false, reason: "no cookies on disk" };

  try {
    const response = await fetch(PROBE_URL, {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        cookie: cookies,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      method: "GET",
      redirect: "follow",
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    // Unlike the first hop in getWMorderData (which is deliberately
    // cookie-less and ALWAYS lands on /login), this request carries cookies —
    // so a login redirect here really does mean the session is dead.
    if (/\/login(\?|$)/.test(response.url)) {
      return { ok: false, reason: `redirected to ${response.url}` };
    }

    const body = await response.text();
    const loggedOut = LOGGED_OUT_MARKERS.find(m => body.includes(m));
    if (loggedOut) return { ok: false, reason: `login wall ("${loggedOut}")` };
    if (looksLikeBareSpaShell(body)) {
      return { ok: false, reason: "bare SPA shell" };
    }

    return { ok: true, reason: "session alive" };
  } catch (error) {
    // Network trouble is not proof of an expired session — say so, so the
    // caller can avoid a pointless re-login during an outage.
    return { ok: false, reason: `probe request failed: ${error.message}` };
  }
}

/**
 * Persist a fetched WorkMarket page for post-mortem. Failures are always kept;
 * successes only when CONFIG.WM_DEBUG_DUMP_ALL is on. Filenames are unique, so
 * unlike the old fixed debug_response.html these survive the next fetch.
 *
 * @returns {string|null} path written, or null if nothing was written
 */
export function dumpWMBody(body, workOrderId = "unknown", reason = "failure") {
  const isFailure = reason !== "ok";
  if (!isFailure && !CONFIG.WM_DEBUG_DUMP_ALL) return null;

  try {
    const dir = path.join(process.cwd(), "logs", "wm-pages");
    fs.mkdirSync(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const slug = String(reason).replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
    const file = path.join(dir, `wm-${workOrderId}-${stamp}-${slug}.html`);

    fs.writeFileSync(file, body ?? "");
    return file;
  } catch (error) {
    logger.error(`Failed to dump WM page: ${error.message}`, "WorkMarket");
    return null;
  }
}
