import fs from "node:fs";
import path from "node:path";
import { materializeFieldNationRequest } from "./materializeFieldNationRequest.js";
import { materializeWorkMarketRequest } from "./materializeWorkMarketRequest.js";
export function isWorkMarketLoginResponse(responseBody) {
    return (/login\?redirectTo=/i.test(responseBody) ||
        /please sign in/i.test(responseBody) ||
        /<title>\s*login\b/i.test(responseBody));
}
export function hasWorkMarketAssignmentMarkers(responseBody) {
    return (/assignment-details/i.test(responseBody) &&
        /<title>.*-\s*Work Market<\/title>/i.test(responseBody));
}
export function hasWorkMarketErrorMarkers(responseBody) {
    return (/please correct the errors below/i.test(responseBody) ||
        /alert-error/i.test(responseBody) ||
        /--error/i.test(responseBody));
}
export function validateWorkMarketResponse(responseBody) {
    if (isWorkMarketLoginResponse(responseBody)) {
        throw new Error("WorkMarket submission returned a login page; session is not authenticated");
    }
    if (hasWorkMarketErrorMarkers(responseBody)) {
        throw new Error("WorkMarket submission returned an error page");
    }
    if (!hasWorkMarketAssignmentMarkers(responseBody)) {
        throw new Error("WorkMarket submission returned an unexpected response page");
    }
}
export function isFieldNationLoginResponse(responseBody) {
    return (/sign in/i.test(responseBody) ||
        /<title>\s*login\b/i.test(responseBody) ||
        /password/i.test(responseBody));
}
export function isFieldNationJsonContentType(contentType) {
    return typeof contentType === "string" && /application\/json/i.test(contentType);
}
export function validateFieldNationResponse(input) {
    if (isFieldNationLoginResponse(input.responseBody)) {
        throw new Error("FieldNation submission returned a login page; session is not authenticated");
    }
    if (isFieldNationJsonContentType(input.contentType)) {
        let parsed;
        try {
            parsed = JSON.parse(input.responseBody);
        }
        catch {
            throw new Error("FieldNation submission returned invalid JSON");
        }
        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("FieldNation submission returned an unexpected JSON response");
        }
        const record = parsed;
        if ("errors" in record || "error" in record) {
            throw new Error("FieldNation submission returned an error response");
        }
        if ("id" in record ||
            "requestId" in record ||
            "work_order_id" in record ||
            "workOrderId" in record ||
            "counter" in record ||
            "active" in record) {
            return;
        }
        throw new Error("FieldNation submission returned an unexpected JSON response");
    }
    if (!input.responseBody.trim()) {
        throw new Error("FieldNation submission returned an empty response");
    }
}
function readCookies(cookiePathCandidates) {
    for (const filePath of cookiePathCandidates) {
        if (!fs.existsSync(filePath)) {
            continue;
        }
        const cookiesJson = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (!Array.isArray(cookiesJson)) {
            continue;
        }
        const cookies = cookiesJson
            .filter(cookie => typeof cookie?.name === "string" &&
            typeof cookie?.value === "string")
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join("; ");
        if (cookies) {
            return cookies;
        }
    }
    throw new Error("No valid cookies found");
}
function extractCsrfToken(cookies) {
    const csrfCookie = cookies
        .split(";")
        .find(cookie => cookie.trim().startsWith("CSRFToken="));
    if (!csrfCookie) {
        throw new Error("CSRFToken cookie not found");
    }
    return csrfCookie.split("=")[1] ?? "";
}
async function submitMaterializedRequest(input) {
    const response = await fetch(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body
    });
    const responseBody = await response.text();
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${responseBody}`);
    }
    if (input.platform === "WorkMarket") {
        validateWorkMarketResponse(responseBody);
    }
    if (input.platform === "FieldNation") {
        validateFieldNationResponse({
            responseBody,
            contentType
        });
    }
    return {
        status: "submitted",
        statusCode: response.status,
        responseBody
    };
}
export async function submitPlatformRequest(request) {
    if (request.platform === "WorkMarket") {
        const cookies = readCookies([
            path.resolve(process.cwd(), "../utils/WorkMarket/autoCookies.json"),
            path.resolve(process.cwd(), "../utils/WorkMarket/cookies.json")
        ]);
        const csrfToken = extractCsrfToken(cookies);
        const materialized = materializeWorkMarketRequest(request, {
            cookies,
            csrfToken
        });
        return submitMaterializedRequest({
            ...materialized,
            platform: request.platform
        });
    }
    if (request.platform === "FieldNation") {
        const cookies = readCookies([
            path.resolve(process.cwd(), "../utils/FieldNation/cookies.json")
        ]);
        const userId = Number(process.env.FIELD_NATION_USER_ID || 983643);
        const materialized = materializeFieldNationRequest(request, {
            cookies,
            userId
        });
        return submitMaterializedRequest({
            ...materialized,
            platform: request.platform
        });
    }
    throw new Error(`Unsupported platform: ${request.platform}`);
}
