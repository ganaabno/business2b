import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";

const root = process.cwd();
const envLoadOrder = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
];

const mergedEnvFromFiles = {};

for (const fileName of envLoadOrder) {
  const fullPath = path.join(root, fileName);
  if (!fs.existsSync(fullPath)) {
    continue;
  }

  const parsed = dotenv.parse(fs.readFileSync(fullPath, "utf8"));
  Object.assign(mergedEnvFromFiles, parsed);
}

for (const [key, value] of Object.entries(mergedEnvFromFiles)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

function normalize(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function toUrl(value, envName, errors) {
  try {
    return new URL(value);
  } catch {
    errors.push(`${envName} must be a valid absolute URL (received: ${value || "<empty>"})`);
    return null;
  }
}

const baseUrl = normalize(process.env.VITE_BASE_URL);
const apiBaseUrl = normalize(process.env.VITE_API_BASE_URL);

const errors = [];
const warnings = [];

if (!baseUrl) {
  errors.push("VITE_BASE_URL is required for cPanel production builds.");
}

if (!apiBaseUrl) {
  errors.push(
    "VITE_API_BASE_URL is required for cPanel production builds (example: https://api.gtrip.mn).",
  );
}

const parsedBase = baseUrl ? toUrl(baseUrl, "VITE_BASE_URL", errors) : null;
const parsedApiBase = apiBaseUrl ? toUrl(apiBaseUrl, "VITE_API_BASE_URL", errors) : null;

if (parsedBase && parsedApiBase) {
  if (parsedBase.origin.toLowerCase() === parsedApiBase.origin.toLowerCase()) {
    errors.push(
      "VITE_API_BASE_URL must point to your backend origin (usually api subdomain), not the frontend domain.",
    );
  }

  if (parsedApiBase.pathname && parsedApiBase.pathname !== "/") {
    errors.push(
      "VITE_API_BASE_URL must be origin-only (no path). Example: https://api.gtrip.mn",
    );
  }

  if (parsedBase.protocol !== "https:") {
    warnings.push("VITE_BASE_URL is not https. Use https in production.");
  }

  if (parsedApiBase.protocol !== "https:") {
    warnings.push("VITE_API_BASE_URL is not https. Use https in production.");
  }
}

if (apiBaseUrl.endsWith("/api") || apiBaseUrl.endsWith("/api/v1")) {
  errors.push(
    "Do not include /api or /api/v1 in VITE_API_BASE_URL. The app appends endpoint paths automatically.",
  );
}

if (warnings.length > 0) {
  console.warn("[cpanel-env] warnings:");
  warnings.forEach((warning) => {
    console.warn(`  - ${warning}`);
  });
}

if (errors.length > 0) {
  console.error("[cpanel-env] validation failed:");
  errors.forEach((error) => {
    console.error(`  - ${error}`);
  });
  process.exit(1);
}

console.log("[cpanel-env] ok");
console.log(`  - VITE_BASE_URL=${baseUrl}`);
console.log(`  - VITE_API_BASE_URL=${apiBaseUrl}`);
