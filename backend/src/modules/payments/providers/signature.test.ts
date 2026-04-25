import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { verifyHmacSha256Signature } from "./signature.js";

test("valid hmac signature passes", () => {
  const body = { seatRequestId: "abc", amount: 1000 };
  const secret = "top-secret";
  const sig = crypto.createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");

  assert.doesNotThrow(() => {
    verifyHmacSha256Signature({
      headers: { "x-qpay-signature": sig },
      body,
      secret,
      signatureHeaderName: "x-qpay-signature",
    });
  });
});

test("invalid hmac signature fails", () => {
  const body = { seatRequestId: "abc", amount: 1000 };
  const secret = "top-secret";

  assert.throws(() => {
    verifyHmacSha256Signature({
      headers: { "x-qpay-signature": "invalid" },
      body,
      secret,
      signatureHeaderName: "x-qpay-signature",
    });
  });
});

test("raw body is used when provided", () => {
  const parsedBody = { seatRequestId: "abc", amount: 1000 };
  const rawBody = Buffer.from('{"amount":1000,"seatRequestId":"abc"}');
  const secret = "top-secret";
  const sig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  assert.doesNotThrow(() => {
    verifyHmacSha256Signature({
      headers: { "x-qpay-signature": sig },
      body: parsedBody,
      rawBody,
      secret,
      signatureHeaderName: "x-qpay-signature",
    });
  });
});
