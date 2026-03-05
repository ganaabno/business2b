import crypto from "node:crypto";
import { forbidden } from "../../../shared/http/errors.js";

const getHeader = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string => {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
};

export function verifyHmacSha256Signature(params: {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  rawBody?: Buffer;
  secret: string;
  signatureHeaderName: string;
  hexPrefix?: string;
}) {
  const given = getHeader(params.headers, params.signatureHeaderName).trim();
  if (!given) {
    throw forbidden("Missing webhook signature");
  }

  const rawBody = params.rawBody || Buffer.from(JSON.stringify(params.body ?? {}));
  const digest = crypto.createHmac("sha256", params.secret).update(rawBody).digest("hex");
  const expected = params.hexPrefix ? `${params.hexPrefix}${digest}` : digest;

  const safeGiven = Buffer.from(given);
  const safeExpected = Buffer.from(expected);
  if (safeGiven.length !== safeExpected.length || !crypto.timingSafeEqual(safeGiven, safeExpected)) {
    throw forbidden("Invalid webhook signature");
  }
}
