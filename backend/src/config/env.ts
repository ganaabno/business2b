import { config as loadDotEnv } from "dotenv";

loadDotEnv();
loadDotEnv({ path: "backend/.env", override: false });

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const required: Array<[string, string]> = [
  ["DATABASE_URL or NEON_DATABASE_URL", databaseUrl],
  ["SUPABASE_URL or VITE_SUPABASE_URL", supabaseUrl],
  ["SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY", supabaseAnonKey],
];

for (const [key, value] of required) {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const toPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const toBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const toCsv = (value: string | undefined) => {
  if (!value) return [] as string[];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

export const env = {
  port: Number(process.env.PORT || 8080),
  nodeEnv,
  isProduction,
  databaseUrl,
  supabaseUrl,
  supabaseAnonKey,
  neonWriteUrl: process.env.NEON_WRITE_URL || process.env.NEON_DATABASE_URL || "",
  globalToursApiBaseUrl: (
    process.env.GLOBAL_TOURS_API_BASE_URL || process.env.VITE_GLOBAL_API_BASE_URL || ""
  ).replace(/\/$/, ""),
  globalToursApiPath:
    process.env.GLOBAL_TOURS_API_PATH || process.env.VITE_GLOBAL_API_TOURS_PATH || "/api/tours",
  globalToursApiTimeoutMs: toPositiveInt(
    process.env.GLOBAL_TOURS_API_TIMEOUT_MS || process.env.VITE_GLOBAL_API_TIMEOUT_MS,
    8000,
  ),
  globalToursSyncEnabled: toBool(process.env.GLOBAL_TOURS_SYNC_ENABLED, false),
  globalToursSyncOnStartup: toBool(process.env.GLOBAL_TOURS_SYNC_ON_STARTUP, true),
  globalToursSyncIntervalMs: toPositiveInt(process.env.GLOBAL_TOURS_SYNC_INTERVAL_MS, 5 * 60 * 1000),
  globalToursSyncSourceSystem:
    (process.env.GLOBAL_TOURS_SYNC_SOURCE_SYSTEM || "global-travel").trim().toLowerCase() ||
    "global-travel",
  qpayWebhookSecret: process.env.QPAY_WEBHOOK_SECRET || "",
  outboxMaxRetries: toPositiveInt(process.env.OUTBOX_MAX_RETRIES, 12),
  b2bRoleV2Enabled: String(process.env.B2B_ROLE_V2_ENABLED || "false").toLowerCase() === "true",
  b2bSeatRequestFlowEnabled:
    String(process.env.B2B_SEAT_REQUEST_FLOW_ENABLED || "false").toLowerCase() === "true",
  b2bMonitoringEnabled: String(process.env.B2B_MONITORING_ENABLED || "false").toLowerCase() === "true",
  b2bGroupPolicyEnabled:
    String(process.env.B2B_GROUP_POLICY_ENABLED || "false").toLowerCase() === "true",
  b2bGroupPolicyEnforce:
    String(process.env.B2B_GROUP_POLICY_ENFORCE || "false").toLowerCase() === "true",
  b2bAdminTestModeEnabled:
    String(process.env.B2B_ADMIN_TEST_MODE_ENABLED || "false").toLowerCase() === "true",
  b2bAdminTestModeIpAllowlist: toCsv(process.env.B2B_ADMIN_TEST_MODE_IP_ALLOWLIST),
};
