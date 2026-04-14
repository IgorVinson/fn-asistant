import test from "node:test";
import assert from "node:assert/strict";

import { materializeFieldNationRequest } from "../src/execution/materializeFieldNationRequest.js";
import { materializeWorkMarketRequest } from "../src/execution/materializeWorkMarketRequest.js";
import type { PlatformRequestSpec } from "../src/execution/types.js";

test("materializeWorkMarketRequest injects csrf token into form body", () => {
  const request: PlatformRequestSpec = {
    platform: "WorkMarket",
    action: "counter",
    method: "POST",
    path: "/assignments/negotiate/6224814719",
    contentType: "application/x-www-form-urlencoded",
    body: {
      _tk: "<csrf-token>",
      per_hour_price: 65,
      additional_expenses: 70
    },
    auth: {
      requiresCookies: true,
      requiresCsrfToken: true
    }
  };

  const materialized = materializeWorkMarketRequest(request, {
    cookies: "CSRFToken=abc123; session=xyz",
    csrfToken: "abc123"
  });

  assert.equal(materialized.url, "https://www.workmarket.com/assignments/negotiate/6224814719");
  assert.match(materialized.body, /_tk=abc123/);
  assert.match(materialized.body, /per_hour_price=65/);
  assert.equal(materialized.headers.cookie, "CSRFToken=abc123; session=xyz");
});

test("materializeFieldNationRequest injects user id into path and body", () => {
  const request: PlatformRequestSpec = {
    platform: "FieldNation",
    action: "counter",
    method: "POST",
    path: "/v2/workorders/18899424/requests?acting_user_id=<user-id>&clientPayTermsAccepted=true",
    contentType: "application/json",
    body: {
      technician: { id: "<user-id>" },
      pay: {
        type: "hourly",
        base: {
          units: 3,
          amount: 65
        }
      }
    },
    auth: {
      requiresCookies: true,
      requiresCsrfToken: false
    }
  };

  const materialized = materializeFieldNationRequest(request, {
    cookies: "session=xyz",
    userId: 983643
  });

  assert.equal(
    materialized.url,
    "https://app.fieldnation.com/v2/workorders/18899424/requests?acting_user_id=983643&clientPayTermsAccepted=true"
  );
  assert.equal(materialized.headers.cookie, "session=xyz");
  assert.match(materialized.body, /983643/);
});
