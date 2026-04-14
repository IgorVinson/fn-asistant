import test from "node:test";
import assert from "node:assert/strict";

import {
  isFieldNationJsonContentType,
  isFieldNationLoginResponse,
  hasWorkMarketAssignmentMarkers,
  hasWorkMarketErrorMarkers,
  isWorkMarketLoginResponse,
  validateFieldNationResponse,
  validateWorkMarketResponse
} from "../src/execution/submitPlatformRequest.js";

test("detects WorkMarket login responses", () => {
  assert.equal(
    isWorkMarketLoginResponse(
      '<html><title>Login - WorkMarket</title><a href="/login?redirectTo=/assignments/details/1">'
    ),
    true
  );
});

test("detects WorkMarket assignment pages", () => {
  assert.equal(
    hasWorkMarketAssignmentMarkers(
      '<html><title>Example Assignment - Work Market</title><body class="assignment-details"></body></html>'
    ),
    true
  );
});

test("detects WorkMarket error markers", () => {
  assert.equal(
    hasWorkMarketErrorMarkers(
      '<div class="alert-error">Please correct the errors below</div>'
    ),
    true
  );
});

test("validateWorkMarketResponse rejects login pages", () => {
  assert.throws(
    () =>
      validateWorkMarketResponse(
        '<html><title>Login - WorkMarket</title><a href="/login?redirectTo=/assignments/details/1">'
      ),
    /not authenticated/
  );
});

test("validateWorkMarketResponse rejects explicit error pages", () => {
  assert.throws(
    () =>
      validateWorkMarketResponse(
        '<html><title>Example Assignment - Work Market</title><body class="assignment-details"><div class="alert-error">Validation failed</div></body></html>'
      ),
    /error page/
  );
});

test("validateWorkMarketResponse accepts assignment details pages", () => {
  assert.doesNotThrow(() =>
    validateWorkMarketResponse(
      '<html><title>Example Assignment - Work Market</title><body class="assignment-details"></body></html>'
    )
  );
});

test("detects FieldNation login responses", () => {
  assert.equal(
    isFieldNationLoginResponse("<html><title>Sign In</title><form>Password</form></html>"),
    true
  );
});

test("detects FieldNation JSON content types", () => {
  assert.equal(isFieldNationJsonContentType("application/json; charset=utf-8"), true);
});

test("validateFieldNationResponse rejects login pages", () => {
  assert.throws(
    () =>
      validateFieldNationResponse({
        responseBody: "<html><title>Sign In</title><form>Password</form></html>",
        contentType: "text/html"
      }),
    /not authenticated/
  );
});

test("validateFieldNationResponse rejects error JSON", () => {
  assert.throws(
    () =>
      validateFieldNationResponse({
        responseBody: JSON.stringify({ errors: [{ message: "Bad request" }] }),
        contentType: "application/json"
      }),
    /error response/
  );
});

test("validateFieldNationResponse accepts successful JSON", () => {
  assert.doesNotThrow(() =>
    validateFieldNationResponse({
      responseBody: JSON.stringify({ id: 123, work_order_id: 456, active: true }),
      contentType: "application/json"
    })
  );
});

test("validateFieldNationResponse accepts non-empty text responses", () => {
  assert.doesNotThrow(() =>
    validateFieldNationResponse({
      responseBody: "Work order request sent successfully",
      contentType: "text/plain"
    })
  );
});
