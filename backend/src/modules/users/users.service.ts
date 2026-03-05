import { q } from "../../db/transaction.js";
import { logger } from "../../shared/logger.js";

type UserPayload = Record<string, unknown>;

type PendingUserPayload = Record<string, unknown>;

type AuthRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

function asString(value: unknown) {
  return String(value || "").trim();
}

function getUserId(row: UserPayload) {
  return (
    asString(row.id) ||
    asString(row.userId) ||
    asString(row.user_id) ||
    asString(row.auth_user_id)
  );
}

function getSortTimestamp(row: UserPayload) {
  return (
    asString(row.created_at) ||
    asString(row.createdAt) ||
    asString(row.updated_at) ||
    asString(row.updatedAt)
  );
}

function buildAuthOnlyUser(row: AuthRow): UserPayload {
  const email = asString(row.email);
  const fallbackUsername = email
    ? email.split("@")[0]
    : `user_${row.id.slice(0, 8)}`;
  const createdAt = asString(row.created_at);
  const updatedAt = asString(row.last_sign_in_at) || createdAt;

  return {
    id: row.id,
    userId: row.id,
    auth_user_id: row.id,
    email,
    username: fallbackUsername,
    role: "user",
    access: "active",
    status: "approved",
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt,
    source: "auth_only",
  };
}

export async function listUsersService() {
  const byId = new Map<string, UserPayload>();

  try {
    const { rows: publicRows } = await q<{ payload: UserPayload }>(
      `select to_jsonb(u) as payload from public.users u`,
      [],
    );

    for (const row of publicRows) {
      const payload = row.payload || {};
      const id = getUserId(payload);
      if (!id) continue;
      byId.set(id, payload);
    }
  } catch (error) {
    logger.warn("Unable to query public.users in listUsersService", error);
  }

  try {
    const { rows: authRows } = await q<AuthRow>(
      `
      select
        id::text,
        email,
        created_at::text,
        last_sign_in_at::text
      from auth.users
      `,
      [],
    );

    for (const authRow of authRows) {
      const existing = byId.get(authRow.id);
      if (existing) {
        if (!asString(existing.email) && asString(authRow.email)) {
          existing.email = asString(authRow.email);
        }
        if (!asString(existing.auth_user_id)) {
          existing.auth_user_id = authRow.id;
        }
        byId.set(authRow.id, existing);
        continue;
      }

      byId.set(authRow.id, buildAuthOnlyUser(authRow));
    }
  } catch (error) {
    logger.warn("Unable to query auth.users in listUsersService", error);
  }

  if (byId.size === 0) {
    logger.warn("listUsersService resolved no rows from any source");
    return [];
  }

  return Array.from(byId.values()).sort((a, b) =>
    getSortTimestamp(b).localeCompare(getSortTimestamp(a)),
  );
}

export async function listPendingUsersService() {
  try {
    const { rows } = await q<{ payload: PendingUserPayload }>(
      `
      select to_jsonb(pu) as payload
      from public.pending_users pu
      where coalesce(pu.status, 'pending') = 'pending'
      order by pu.created_at desc
      `,
      [],
    );

    return rows.map((row) => row.payload);
  } catch (error) {
    logger.warn(
      "Unable to query pending users in listPendingUsersService",
      error,
    );
    return [];
  }
}
