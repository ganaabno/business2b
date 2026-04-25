import { env } from "../../config/env.js";
import { badRequest } from "../../shared/http/errors.js";

type CachedAuthToken = {
  token: string;
  expiresAtMs: number;
};

export type GlobalTaskRecord = {
  id: string;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  sortOrder?: number | null;
  isCompleted?: boolean;
  assigneeId?: string | null;
  assigneeIds?: string[];
  assigneeName?: string | null;
  assigneeNames?: string[];
  creatorId?: string | null;
  creatorName?: string | null;
  dueDate?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type GlobalTaskAssigneeRecord = {
  id: string;
  firstname?: string;
  lastname?: string;
  email: string;
  role?: string;
};

const TOKEN_SAFETY_BUFFER_MS = 30_000;
const DEFAULT_TOKEN_TTL_MS = 50 * 60 * 1000;
const FALLBACK_GLOBAL_API_BASE = "https://b2c-production.up.railway.app";

let cachedToken: CachedAuthToken | null = null;

function normalizePath(path: string) {
  const normalized = String(path || "").trim();
  if (!normalized) return "/";
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseJsonPayload(text: string): unknown {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function payloadMessage(payload: unknown, fallback: string) {
  const source = asRecord(payload);
  if (!source) return fallback;

  const direct = source.message || source.error;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const nested = asRecord(source.data);
  if (!nested) return fallback;

  const nestedMessage = nested.message || nested.error;
  if (typeof nestedMessage === "string" && nestedMessage.trim()) {
    return nestedMessage.trim();
  }

  return fallback;
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function decodeJwtExpiryMs(token: string): number | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payloadText = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadText) as { exp?: number };
    if (!Number.isFinite(payload.exp)) return null;
    return Number(payload.exp) * 1000;
  } catch {
    return null;
  }
}

function extractToken(payload: unknown): string | null {
  const direct = asRecord(payload);
  if (!direct) return null;

  const directToken =
    direct.token || direct.accessToken || direct.access_token || direct.jwt;
  if (typeof directToken === "string" && directToken.trim()) {
    return directToken.trim();
  }

  const nested = asRecord(direct.data);
  if (!nested) return null;

  const nestedToken =
    nested.token || nested.accessToken || nested.access_token || nested.jwt;
  if (typeof nestedToken === "string" && nestedToken.trim()) {
    return nestedToken.trim();
  }

  return null;
}

function getGlobalApiBaseUrl() {
  const writeBaseUrl = String(env.globalToursWriteApiBaseUrl || "").trim();
  if (writeBaseUrl) {
    return writeBaseUrl.replace(/\/$/, "");
  }

  const readBaseUrl = String(env.globalToursApiBaseUrl || "").trim();
  if (readBaseUrl) {
    return readBaseUrl.replace(/\/$/, "");
  }

  return FALLBACK_GLOBAL_API_BASE;
}

async function loginGlobalService(forceRefresh = false) {
  if (
    !forceRefresh &&
    cachedToken &&
    cachedToken.expiresAtMs > Date.now() + TOKEN_SAFETY_BUFFER_MS
  ) {
    return cachedToken.token;
  }

  const email = asNullableString(env.globalToursServiceEmail);
  const password = asNullableString(env.globalToursServicePassword);

  if (!email || !password) {
    throw badRequest(
      "Global task bridge credentials are not configured (GLOBAL_TOURS_SERVICE_EMAIL / GLOBAL_TOURS_SERVICE_PASSWORD)",
    );
  }

  const baseUrl = getGlobalApiBaseUrl();
  const authPath = normalizePath(env.globalToursAuthPath);

  const response = await fetch(`${baseUrl}${authPath}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const text = await response.text();
  const payload = parseJsonPayload(text);

  if (!response.ok) {
    throw new Error(
      `Global auth failed (${response.status}): ${payloadMessage(payload, "Unable to authenticate to Global API")}`,
    );
  }

  const token = extractToken(payload);
  if (!token) {
    throw new Error("Global auth response does not include a bearer token");
  }

  const expiresAtMs =
    decodeJwtExpiryMs(token) || Date.now() + DEFAULT_TOKEN_TTL_MS;

  cachedToken = {
    token,
    expiresAtMs,
  };

  return token;
}

async function requestGlobalTaskApi(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
) {
  const baseUrl = getGlobalApiBaseUrl();
  const requestPath = normalizePath(path);
  const requestUrl = `${baseUrl}${requestPath}`;

  let token = await loginGlobalService(false);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(requestUrl, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const payload = parseJsonPayload(text);

    if (response.status === 401 && attempt === 0) {
      cachedToken = null;
      token = await loginGlobalService(true);
      continue;
    }

    if (!response.ok) {
      throw new Error(
        `Global tasks API ${method} ${requestPath} failed (${response.status}): ${payloadMessage(payload, "Request failed")}`,
      );
    }

    return payload;
  }

  throw new Error(`Global tasks API ${method} ${requestPath} failed after token refresh`);
}

function normalizeTaskRecord(raw: unknown): GlobalTaskRecord | null {
  const row = asRecord(raw);
  if (!row) return null;

  const id = asNullableString(row.id);
  if (!id) return null;

  const assigneeIds = Array.isArray(row.assigneeIds)
    ? row.assigneeIds
        .map((value) => asNullableString(value))
        .filter((value): value is string => Boolean(value))
    : undefined;

  const assigneeNames = Array.isArray(row.assigneeNames)
    ? row.assigneeNames
        .map((value) => asNullableString(value))
        .filter((value): value is string => Boolean(value))
    : undefined;

  const sortOrder = Number(row.sortOrder);

  return {
    id,
    title: asNullableString(row.title),
    description: asNullableString(row.description),
    priority: asNullableString(row.priority),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : null,
    isCompleted: Boolean(row.isCompleted),
    assigneeId: asNullableString(row.assigneeId),
    assigneeIds,
    assigneeName: asNullableString(row.assigneeName),
    assigneeNames,
    creatorId: asNullableString(row.creatorId),
    creatorName: asNullableString(row.creatorName),
    dueDate: asNullableString(row.dueDate),
    approvedAt: asNullableString(row.approvedAt),
    approvedById: asNullableString(row.approvedById),
    createdAt: asNullableString(row.createdAt),
    updatedAt: asNullableString(row.updatedAt),
  };
}

function extractTaskArray(payload: unknown): GlobalTaskRecord[] {
  if (Array.isArray(payload)) {
    return payload
      .map((row) => normalizeTaskRecord(row))
      .filter((row): row is GlobalTaskRecord => Boolean(row));
  }

  const source = asRecord(payload);
  if (!source) return [];

  const directTasks = Array.isArray(source.tasks) ? source.tasks : null;
  if (directTasks) {
    return directTasks
      .map((row) => normalizeTaskRecord(row))
      .filter((row): row is GlobalTaskRecord => Boolean(row));
  }

  const nested = asRecord(source.data);
  if (!nested) return [];

  if (Array.isArray(nested.tasks)) {
    return nested.tasks
      .map((row) => normalizeTaskRecord(row))
      .filter((row): row is GlobalTaskRecord => Boolean(row));
  }

  return [];
}

function extractSingleTask(payload: unknown): GlobalTaskRecord | null {
  const source = asRecord(payload);
  if (!source) return null;

  if (source.task) {
    return normalizeTaskRecord(source.task);
  }

  const nested = asRecord(source.data);
  if (!nested) return null;

  if (nested.task) {
    return normalizeTaskRecord(nested.task);
  }

  return normalizeTaskRecord(nested);
}

function normalizeAssignee(raw: unknown): GlobalTaskAssigneeRecord | null {
  const row = asRecord(raw);
  if (!row) return null;

  const id = asNullableString(row.id);
  const email = asNullableString(row.email);
  if (!id || !email) return null;

  return {
    id,
    email,
    firstname: asNullableString(row.firstname) || "",
    lastname: asNullableString(row.lastname) || "",
    role: asNullableString(row.role) || "",
  };
}

function extractAssigneeArray(payload: unknown): GlobalTaskAssigneeRecord[] {
  const source = asRecord(payload);
  if (!source) return [];

  const users = Array.isArray(source.users)
    ? source.users
    : (() => {
        const nested = asRecord(source.data);
        if (!nested || !Array.isArray(nested.users)) return [];
        return nested.users;
      })();

  return users
    .map((row) => normalizeAssignee(row))
    .filter((row): row is GlobalTaskAssigneeRecord => Boolean(row));
}

export async function listGlobalTasks() {
  const payload = await requestGlobalTaskApi("GET", env.globalTasksApiPath);
  return extractTaskArray(payload);
}

export async function listGlobalTaskAssignees() {
  const basePath = normalizePath(env.globalTasksApiPath);
  const payload = await requestGlobalTaskApi("GET", `${basePath}/assignees`);
  return extractAssigneeArray(payload);
}

export async function createGlobalTask(payload: Record<string, unknown>) {
  const responsePayload = await requestGlobalTaskApi(
    "POST",
    env.globalTasksApiPath,
    payload,
  );

  return extractSingleTask(responsePayload);
}

export async function updateGlobalTask(
  taskId: string,
  payload: Record<string, unknown>,
) {
  const basePath = normalizePath(env.globalTasksApiPath);
  const encodedId = encodeURIComponent(taskId);
  const responsePayload = await requestGlobalTaskApi(
    "PATCH",
    `${basePath}/${encodedId}`,
    payload,
  );

  return extractSingleTask(responsePayload);
}

export async function approveGlobalTask(taskId: string) {
  const basePath = normalizePath(env.globalTasksApiPath);
  const encodedId = encodeURIComponent(taskId);
  const responsePayload = await requestGlobalTaskApi(
    "POST",
    `${basePath}/${encodedId}/approve`,
  );

  return extractSingleTask(responsePayload);
}
