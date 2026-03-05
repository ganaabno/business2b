import assert from "node:assert/strict";
import test from "node:test";
import { getPaymentProviderAdapter } from "./index.js";

test("returns qpay adapter for qpay provider", () => {
  const adapter = getPaymentProviderAdapter("qpay");
  assert.equal(adapter.provider, "qpay");
});

test("throws for unsupported provider", () => {
  assert.throws(() => getPaymentProviderAdapter("unknown-provider"));
});
