import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { q } from "../../db/transaction.js";
import { unauthorized } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AppRole, AuthUser } from "../../shared/types/auth.js";

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false },
});

const AUTH_LOOKUP_CACHE_TTL_MS = env.isProduction ? 30_000 : 10_000;
const AUTH_LOOKUP_CACHE_MAX_ITEMS = 2000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const userPayloadByIdCache = new Map<
  string,
  CacheEntry<Record<string, unknown> | null>
>();
const userPayloadByAuthUserIdCache = new Map<
  string,
  CacheEntry<Record<string, unknown> | null>
>();
const userPayloadByEmailCache = new Map<
  string,
  CacheEntry<Record<string, unknown> | null>
>();
const primaryOrgByUserIdCache = new Map<string, CacheEntry<string | null>>();
let usersColumnSetCache: CacheEntry<Set<string>> | null = null;

function readCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
}

function writeCacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + AUTH_LOOKUP_CACHE_TTL_MS,
  });

  if (cache.size <= AUTH_LOOKUP_CACHE_MAX_ITEMS) {
    return;
  }

  const now = Date.now();
  for (const [cacheKey, cacheEntry] of cache.entries()) {
    if (cacheEntry.expiresAt <= now) {
      cache.delete(cacheKey);
    }
  }

  while (cache.size > AUTH_LOOKUP_CACHE_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    cache.delete(oldestKey);
  }
}

function normalizeRole(value: unknown): AppRole {
  const role = String(value ?? "").toLowerCase();
  switch (role) {
    case "admin":
      return "admin";
    case "manager":
      return "manager";
    case "subcontractor":
    case "user":
      return "subcontractor";
    case "agent":
    case "provider":
      return "agent";
    case "superadmin":
      return "admin";
    default:
      return "subcontractor";
  }
}

function resolveRoleFromPayload(payload: Record<string, unknown>): AppRole {
  const workspaceRole = String(payload.workspace_role || "").trim();
  if (workspaceRole) {
    return normalizeRole(workspaceRole);
  }

  const roleV2 = String(payload.role_v2 || "").trim();
  if (roleV2) {
    return normalizeRole(roleV2);
  }

  const legacyRole = String(payload.role || "").trim();
  if (legacyRole) {
    return normalizeRole(legacyRole);
  }

  return "subcontractor";
}

function resolveDevelopmentFallbackRole(user: {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const appMetadata = user.app_metadata || {};
  const userMetadata = user.user_metadata || {};

  return resolveRoleFromPayload({
    workspace_role: appMetadata.workspace_role || userMetadata.workspace_role,
    role_v2: appMetadata.role_v2 || userMetadata.role_v2,
    role: appMetadata.role || userMetadata.role,
  });
}

type SupabaseIdentity = {
  identity_data?: {
    email?: unknown;
  } | null;
};

function resolveLookupEmail(user: {
  email?: unknown;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
  identities?: SupabaseIdentity[] | null;
}) {
  const candidates = [
    user.email,
    user.user_metadata?.email,
    user.app_metadata?.email,
    ...(Array.isArray(user.identities)
      ? user.identities.map((identity) => identity?.identity_data?.email)
      : []),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

type UserPayloadRow = {
  payload: Record<string, unknown>;
};

type UsersColumnRow = {
  column_name: string;
};

type PgErrorLike = {
  code?: string;
  message?: string;
};

function isMissingColumnError(error: unknown) {
  const pgError = error as PgErrorLike;
  const message = String(pgError?.message || "").toLowerCase();
  return pgError?.code === "42703" || message.includes("column");
}

async function getUsersColumnSet() {
  const cached = usersColumnSetCache;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const { rows } = await q<UsersColumnRow>(
    `
    select lower(column_name) as column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
    `,
    [],
  );

  const columnSet = new Set(rows.map((row) => row.column_name));
  usersColumnSetCache = {
    value: columnSet,
    expiresAt: Date.now() + AUTH_LOOKUP_CACHE_TTL_MS,
  };

  return columnSet;
}

function normalizeKey(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function buildAuthenticatedUserContext(params: {
  authUserId: string;
  payload: Record<string, unknown>;
  primaryOrganizationId: string | null;
}): AuthUser {
  const profileUserId =
    String(params.payload.id || params.authUserId).trim() || params.authUserId;
  const actorRole = resolveRoleFromPayload(params.payload);

  return {
    id: profileUserId,
    role: actorRole,
    organizationId: params.primaryOrganizationId,
    actorId: params.authUserId,
    actorRole,
  };
}

function cacheUserPayload(
  payload: Record<string, unknown>,
  aliases?: {
    idAliases?: string[];
    authUserIdAliases?: string[];
    emailAliases?: string[];
  },
) {
  const idKeys = new Set([
    normalizeKey(payload.id),
    ...(aliases?.idAliases || []).map((value) => normalizeKey(value)),
  ]);

  const authUserIdKeys = new Set([
    normalizeKey(payload.auth_user_id),
    ...(aliases?.authUserIdAliases || []).map((value) => normalizeKey(value)),
  ]);

  const emailKeys = new Set([
    normalizeEmail(payload.email),
    ...(aliases?.emailAliases || []).map((value) => normalizeEmail(value)),
  ]);

  for (const key of idKeys) {
    if (key) {
      writeCacheValue(userPayloadByIdCache, key, payload);
    }
  }

  for (const key of authUserIdKeys) {
    if (!key) {
      continue;
    }
    writeCacheValue(userPayloadByAuthUserIdCache, key, payload);
    writeCacheValue(userPayloadByIdCache, key, payload);
  }

  for (const key of emailKeys) {
    if (key) {
      writeCacheValue(userPayloadByEmailCache, key, payload);
    }
  }
}

async function getUserPayloadById(userId: string) {
  const normalizedUserId = normalizeKey(userId);
  if (!normalizedUserId) {
    return null;
  }

  const cached = readCacheValue(userPayloadByIdCache, normalizedUserId);
  if (cached !== undefined) {
    return cached;
  }

  const { rows } = await q<UserPayloadRow>(
    `
    select to_jsonb(u) as payload
    from public.users u
    where u.id::text = $1::text
    limit 1
    `,
    [normalizedUserId],
  );

  const payload = rows[0]?.payload || null;
  if (!payload) {
    return null;
  }

  cacheUserPayload(payload, { idAliases: [normalizedUserId] });

  return payload;
}

async function getUserPayloadByAuthUserId(authUserId: string) {
  const normalizedAuthUserId = normalizeKey(authUserId);
  if (!normalizedAuthUserId) {
    return null;
  }

  const cached = readCacheValue(
    userPayloadByAuthUserIdCache,
    normalizedAuthUserId,
  );
  if (cached !== undefined) {
    return cached;
  }

  const usersColumns = await getUsersColumnSet();
  if (!usersColumns.has("auth_user_id")) {
    return null;
  }

  try {
    const { rows } = await q<UserPayloadRow>(
      `
      select to_jsonb(u) as payload
      from public.users u
      where u.auth_user_id::text = $1::text
      limit 1
      `,
      [normalizedAuthUserId],
    );

    const payload = rows[0]?.payload || null;
    if (!payload) {
      return null;
    }

    cacheUserPayload(payload, {
      authUserIdAliases: [normalizedAuthUserId],
      idAliases: [normalizedAuthUserId],
    });

    return payload;
  } catch (error) {
    if (isMissingColumnError(error)) {
      return null;
    }
    throw error;
  }
}

async function getUserPayloadByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const cached = readCacheValue(userPayloadByEmailCache, normalized);
  if (cached !== undefined) {
    return cached;
  }

  const { rows } = await q<UserPayloadRow>(
    `
    select to_jsonb(u) as payload
    from public.users u
    where lower(u.email) = $1
    limit 1
    `,
    [normalized],
  );

  const payload = rows[0]?.payload || null;
  if (!payload) {
    return null;
  }

  cacheUserPayload(payload, { emailAliases: [normalized] });

  return payload;
}

async function getPrimaryOrganizationId(userId: string) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return null;
  }

  const cached = readCacheValue(primaryOrgByUserIdCache, normalizedUserId);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const { rows } = await q<{ organization_id: string | null }>(
      `
      select om.organization_id::text as organization_id
      from public.organization_members om
      where om.user_id::text = $1::text and om.is_primary = true
      limit 1
      `,
      [normalizedUserId],
    );

    const organizationId = rows[0]?.organization_id || null;
    writeCacheValue(primaryOrgByUserIdCache, normalizedUserId, organizationId);
    return organizationId;
  } catch (error) {
    logger.warn(
      "auth.requireAuth organization lookup failed; continuing without org context",
      {
        error,
      },
    );
    return null;
  }
}

export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  await requireAuth(req, _res, (err) => {
    if (err) {
      return next(err);
    }

    const user = req.user as AuthUser | undefined;
    if (!user || (user.role !== "admin" && user.actorRole !== "admin")) {
      return next(unauthorized("Admin access required"));
    }

    next();
  });
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      throw unauthorized("Missing bearer token");
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw unauthorized("Invalid token");
    }

    const lookupEmail = resolveLookupEmail(
      data.user as unknown as {
        email?: unknown;
        app_metadata?: Record<string, unknown> | null;
        user_metadata?: Record<string, unknown> | null;
        identities?: SupabaseIdentity[] | null;
      },
    );

    const userId = data.user.id;
    let payload: Record<string, unknown> | null =
      await getUserPayloadById(userId);

    if (!payload) {
      const payloadByAuthUserId = await getUserPayloadByAuthUserId(userId);
      if (payloadByAuthUserId) {
        payload = payloadByAuthUserId;
        logger.warn(
          "auth.requireAuth matched user profile by auth_user_id fallback",
          {
            userId,
            email: lookupEmail || null,
            profileUserId: String(payloadByAuthUserId.id || "").trim() || null,
          },
        );
      }
    }

    if (!payload && lookupEmail) {
      const payloadByEmail = await getUserPayloadByEmail(lookupEmail);
      if (payloadByEmail) {
        payload = payloadByEmail;
        cacheUserPayload(payloadByEmail, {
          idAliases: [userId],
          authUserIdAliases: [userId],
          emailAliases: [lookupEmail],
        });
        logger.warn("auth.requireAuth matched user profile by email fallback", {
          userId,
          email: lookupEmail,
        });
      }
    }

    if (!payload) {
      if (!env.isProduction) {
        const fallbackRole = resolveDevelopmentFallbackRole(
          data.user as unknown as {
            app_metadata?: Record<string, unknown> | null;
            user_metadata?: Record<string, unknown> | null;
          },
        );

        logger.warn(
          "auth.requireAuth profile missing; using development fallback",
          {
            userId,
            email: lookupEmail || null,
            fallbackRole,
          },
        );

        payload = {
          id: userId,
          email: lookupEmail || null,
          role: fallbackRole,
          role_v2: fallbackRole,
          workspace_role: fallbackRole,
        };
      } else {
        throw unauthorized("User profile not found");
      }
    }

    const profileUserId = String(payload.id || userId).trim() || userId;
    const primaryOrganizationId = await getPrimaryOrganizationId(profileUserId);
    req.user = buildAuthenticatedUserContext({
      authUserId: userId,
      payload,
      primaryOrganizationId,
    });

    next();
  } catch (error) {
    next(error);
  }
}
