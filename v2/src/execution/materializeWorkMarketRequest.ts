import type { PlatformRequestSpec } from "./types.js";

export interface WorkMarketSession {
  cookies: string;
  csrfToken: string;
}

export interface MaterializedRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
}

function toFormEncodedBody(body: Record<string, unknown>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) {
      continue;
    }

    params.set(key, String(value));
  }

  return params.toString();
}

export function materializeWorkMarketRequest(
  request: PlatformRequestSpec,
  session: WorkMarketSession
): MaterializedRequest {
  if (request.platform !== "WorkMarket") {
    throw new Error(`Expected WorkMarket request, received ${request.platform}`);
  }

  const body = {
    ...request.body,
    _tk: session.csrfToken
  };

  return {
    url: `https://www.workmarket.com${request.path}`,
    method: "POST",
    headers: {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "content-type": "application/x-www-form-urlencoded",
      "x-requested-with": "XMLHttpRequest",
      cookie: session.cookies
    },
    body: toFormEncodedBody(body)
  };
}
