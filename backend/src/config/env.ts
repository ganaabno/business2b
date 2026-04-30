import { config as loadDotEnv } from "dotenv";

loadDotEnv();
loadDotEnv({ path: "backend/.env", override: false });

const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "";

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
  corsAllowAllOrigins: toBool(process.env.CORS_ALLOW_ALL_ORIGINS, !isProduction),
  corsAllowedOrigins: toCsv(process.env.CORS_ALLOWED_ORIGINS),
  databaseUrl,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
  neonWriteUrl: process.env.NEON_WRITE_URL || process.env.NEON_DATABASE_URL || "",
  globalToursApiBaseUrl: (
    process.env.GLOBAL_TOURS_API_BASE_URL || process.env.VITE_GLOBAL_API_BASE_URL || ""
  ).replace(/\/$/, ""),
  globalToursApiPath:
    process.env.GLOBAL_TOURS_API_PATH || process.env.VITE_GLOBAL_API_TOURS_PATH || "/api/tours",
  globalToursOrdersPath:
    process.env.GLOBAL_TOURS_ORDERS_PATH ||
    process.env.VITE_GLOBAL_API_ORDERS_PATH ||
    "/api/payments",
  globalTasksApiPath:
    process.env.GLOBAL_TASKS_API_PATH ||
    process.env.VITE_GLOBAL_TASKS_API_PATH ||
    "/api/tasks",
  globalToursApiTimeoutMs: toPositiveInt(
    process.env.GLOBAL_TOURS_API_TIMEOUT_MS || process.env.VITE_GLOBAL_API_TIMEOUT_MS,
    8000,
  ),
  globalToursSyncEnabled: toBool(process.env.GLOBAL_TOURS_SYNC_ENABLED, true),
  globalToursSyncOnStartup: toBool(process.env.GLOBAL_TOURS_SYNC_ON_STARTUP, true),
  globalToursSyncIntervalMs: Math.max(
    toPositiveInt(process.env.GLOBAL_TOURS_SYNC_INTERVAL_MS, 60 * 1000),
    60 * 1000,
  ),
  globalToursSyncSourceSystem:
    (process.env.GLOBAL_TOURS_SYNC_SOURCE_SYSTEM || "global-travel").trim().toLowerCase() ||
    "global-travel",
  globalToursWriteEnabled: toBool(process.env.GLOBAL_TOURS_WRITE_ENABLED, false),
  globalToursWriteApiBaseUrl: (
    process.env.GLOBAL_TOURS_WRITE_API_BASE_URL ||
    process.env.GLOBAL_TOURS_API_BASE_URL ||
    process.env.VITE_GLOBAL_API_BASE_URL ||
    ""
  ).replace(/\/$/, ""),
  globalToursWritePath:
    process.env.GLOBAL_TOURS_WRITE_PATH ||
    process.env.GLOBAL_TOURS_API_PATH ||
    process.env.VITE_GLOBAL_API_TOURS_PATH ||
    "/api/tours",
  globalToursPriceTablePath:
    process.env.GLOBAL_TOURS_PRICE_TABLE_PATH || "/api/price_table",
  globalToursAuthPath: process.env.GLOBAL_TOURS_AUTH_PATH || "/api/auth/login",
  globalToursServiceEmail: process.env.GLOBAL_TOURS_SERVICE_EMAIL || "",
  globalToursServicePassword: process.env.GLOBAL_TOURS_SERVICE_PASSWORD || "",
  qpayWebhookSecret: process.env.QPAY_WEBHOOK_SECRET || "",
  qpayBaseUrl: (process.env.QPAY_BASE_URL || "https://merchant.qpay.mn/v2").replace(/\/$/, ""),
  qpayClientId: process.env.QPAY_CLIENT_ID || "",
  qpayClientSecret: process.env.QPAY_CLIENT_SECRET || "",
  qpayInvoiceCode: process.env.QPAY_INVOICE_CODE || "",
  qpayCallbackUrl: process.env.QPAY_CALLBACK_URL || "",
  emailNotificationsEnabled: toBool(process.env.EMAIL_NOTIFICATIONS_ENABLED, false),
  emailProvider: (process.env.EMAIL_PROVIDER || "mailersend").trim().toLowerCase() || "mailersend",
  emailProviderFallback: (process.env.EMAIL_PROVIDER_FALLBACK || "resend")
    .trim()
    .toLowerCase(),
  mailersendApiKey: process.env.MAILERSEND_API_KEY || process.env.API_KEY || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
  emailReplyTo: process.env.EMAIL_REPLY_TO || "",
  emailAppBaseUrl: (process.env.EMAIL_APP_BASE_URL || process.env.VITE_BASE_URL || "")
    .trim()
    .replace(/\/$/, ""),
  paymentReminderDepositLeadMinutes: toPositiveInt(
    process.env.PAYMENT_REMINDER_DEPOSIT_LEAD_MINUTES,
    120,
  ),
  paymentReminderStandardLeadHours: toPositiveInt(
    process.env.PAYMENT_REMINDER_STANDARD_LEAD_HOURS,
    24,
  ),
  outboxMaxRetries: toPositiveInt(process.env.OUTBOX_MAX_RETRIES, 12),
  b2bRunBackgroundJobs: toBool(process.env.B2B_RUN_BACKGROUND_JOBS, true),
  b2bRoleV2Enabled: String(process.env.B2B_ROLE_V2_ENABLED || "false").toLowerCase() === "true",
  b2bSeatRequestFlowEnabled:
    String(process.env.B2B_SEAT_REQUEST_FLOW_ENABLED || "false").toLowerCase() === "true",
  b2bMonitoringEnabled: String(process.env.B2B_MONITORING_ENABLED || "false").toLowerCase() === "true",
  b2bGroupPolicyEnabled:
    String(process.env.B2B_GROUP_POLICY_ENABLED || "false").toLowerCase() === "true",
  b2bGroupPolicyEnforce:
    String(process.env.B2B_GROUP_POLICY_ENFORCE || "false").toLowerCase() === "true",
  b2bSerialEnforcementEnabled:
    String(process.env.B2B_SERIAL_ENFORCEMENT_ENABLED || "true").toLowerCase() !== "false",
  b2bAllowLegacyDb: toBool(process.env.B2B_ALLOW_LEGACY_DB, false),
  // Groq AI Configuration
  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama3-70b-8192",
  // Legacy Gemini Configuration (deprecated, use Groq instead)
  geminiApiKey: process.env.GEMINI_AI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  geminiMaxTokens: toPositiveInt(process.env.GEMINI_MAX_TOKENS, 1024),
  geminiTemperature: Number(process.env.GEMINI_TEMPERATURE || "0.7"),
};
