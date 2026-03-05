import { qpayAdapter } from "./qpay.adapter.js";
import type { PaymentProviderAdapter } from "./types.js";
import { badRequest } from "../../../shared/http/errors.js";

export function getPaymentProviderAdapter(providerRaw: string): PaymentProviderAdapter {
  const provider = providerRaw.trim().toLowerCase();
  if (!provider) {
    throw badRequest("Payment provider is required");
  }

  const adapters: Record<string, PaymentProviderAdapter> = {
    qpay: qpayAdapter,
  };

  const adapter = adapters[provider];
  if (!adapter) {
    throw badRequest(`Unsupported payment provider: ${provider}`);
  }

  return adapter;
}
