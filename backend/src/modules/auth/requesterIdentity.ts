import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";

type RequesterIdentity = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

type RequesterIdentityCacheEntry = {
  value: RequesterIdentity | null;
  expiresAt: number;
};

type RequesterRow = {
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
  requester_username?: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CACHE_TTL_MS = env.isProduction ? 5 * 60_000 : 60_000;
const CACHE_MAX_ITEMS = 2_000;

let supabaseServiceClient: ReturnType<typeof createClient> | null = null;
let missingServiceRoleWarned = false;

const requesterIdentityCache = new Map<string, RequesterIdentityCacheEntry>();

function asNonEmpty(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
}

function readCache(key: string) {
  const cached = requesterIdentityCache.get(key);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    requesterIdentityCache.delete(key);
    return undefined;
  }

  return cached.value;
}

function writeCache(key: string, value: RequesterIdentity | null) {
  requesterIdentityCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  if (requesterIdentityCache.size <= CACHE_MAX_ITEMS) {
    return;
  }

  const now = Date.now();
  for (const [cacheKey, cacheEntry] of requesterIdentityCache.entries()) {
    if (cacheEntry.expiresAt <= now) {
      requesterIdentityCache.delete(cacheKey);
    }
  }

  while (requesterIdentityCache.size > CACHE_MAX_ITEMS) {
    const oldestKey = requesterIdentityCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    requesterIdentityCache.delete(oldestKey);
  }
}

function getSupabaseServiceClient() {
  if (!env.supabaseServiceRoleKey) {
    if (!missingServiceRoleWarned) {
      missingServiceRoleWarned = true;
      logger.warn(
        "Requester identity enrichment is disabled because SUPABASE_SERVICE_ROLE_KEY is missing",
      );
    }
    return null;
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient(
      env.supabaseUrl,
      env.supabaseServiceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }

  return supabaseServiceClient;
}

function pickFirst(...values: unknown[]) {
  for (const value of values) {
    const normalized = asNonEmpty(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function buildRequesterIdentity(user: {
  email?: unknown;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}) {
  const userMetadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};

  return {
    email: pickFirst(user.email, userMetadata.email, appMetadata.email),
    firstName: pickFirst(
      userMetadata.first_name,
      userMetadata.firstName,
      userMetadata.firstname,
      userMetadata.given_name,
      appMetadata.first_name,
      appMetadata.firstName,
      appMetadata.firstname,
    ),
    lastName: pickFirst(
      userMetadata.last_name,
      userMetadata.lastName,
      userMetadata.lastname,
      userMetadata.family_name,
      appMetadata.last_name,
      appMetadata.lastName,
      appMetadata.lastname,
    ),
    username: pickFirst(
      userMetadata.username,
      userMetadata.user_name,
      userMetadata.preferred_username,
      userMetadata.nickname,
      appMetadata.username,
      appMetadata.user_name,
      userMetadata.name,
    ),
  } satisfies RequesterIdentity;
}

async function fetchRequesterIdentity(authUserId: string) {
  const normalizedId = String(authUserId || "").trim();
  if (!normalizedId || !UUID_PATTERN.test(normalizedId)) {
    return null;
  }

  const cached = readCache(normalizedId);
  if (cached !== undefined) {
    return cached;
  }

  const serviceClient = getSupabaseServiceClient();
  if (!serviceClient) {
    return null;
  }

  const { data, error } =
    await serviceClient.auth.admin.getUserById(normalizedId);
  if (error || !data?.user) {
    writeCache(normalizedId, null);
    return null;
  }

  const identity = buildRequesterIdentity(
    data.user as unknown as {
      email?: unknown;
      user_metadata?: Record<string, unknown> | null;
      app_metadata?: Record<string, unknown> | null;
    },
  );

  writeCache(normalizedId, identity);
  return identity;
}

function needsEnrichment(row: RequesterRow) {
  return !(
    asNonEmpty(row.requester_username) &&
    asNonEmpty(row.requester_email) &&
    (asNonEmpty(row.requester_first_name) ||
      asNonEmpty(row.requester_last_name))
  );
}

export async function enrichRequesterIdentityRows<
  T extends RequesterRow,
>(params: { rows: T[]; getRequesterAuthUserId: (row: T) => string }) {
  const { rows, getRequesterAuthUserId } = params;
  if (rows.length === 0) {
    return rows;
  }

  const pendingIds = new Set<string>();
  for (const row of rows) {
    if (!needsEnrichment(row)) {
      continue;
    }

    const authUserId = String(getRequesterAuthUserId(row) || "").trim();
    if (!authUserId) {
      continue;
    }

    pendingIds.add(authUserId);
  }

  if (pendingIds.size === 0) {
    return rows;
  }

  const entries = await Promise.all(
    Array.from(pendingIds).map(async (authUserId) => {
      const identity = await fetchRequesterIdentity(authUserId);
      return [authUserId, identity] as const;
    }),
  );
  const identityByUserId = new Map(entries);

  return rows.map((row) => {
    const authUserId = String(getRequesterAuthUserId(row) || "").trim();
    const identity = identityByUserId.get(authUserId) || null;
    if (!identity) {
      return row;
    }

    return {
      ...row,
      requester_username:
        asNonEmpty(row.requester_username) || identity.username,
      requester_email: asNonEmpty(row.requester_email) || identity.email,
      requester_first_name:
        asNonEmpty(row.requester_first_name) || identity.firstName,
      requester_last_name:
        asNonEmpty(row.requester_last_name) || identity.lastName,
    };
  });
}
