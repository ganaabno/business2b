import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import { q } from "../../db/transaction.js";
import {
  enqueueAdminTestEmail,
  enqueuePendingUserDecisionEmail,
} from "../notifications/notifications.service.js";
import { ApiError, badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AuthUser } from "../../shared/types/auth.js";
import {
  mapRequestedRoleForPersistence,
  type RoleMapping,
} from "./roleMapping.js";

type UserPayload = Record<string, unknown>;
type PendingUserPayload = Record<string, unknown>;

type AuthRow = {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type PendingUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  role_requested: string | null;
  status: string | null;
  phone: string | null;
  company_name: string | null;
  company_phone: string | null;
  is_company: boolean | null;
  password: string | null;
  password_hash: string | null;
  auth_user_id: string | null;
};

type DbErrorLike = {
  code?: string;
  message?: string;
};

type SupabaseDynamicDatabase = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let supabaseServiceClient: ReturnType<
  typeof createClient<SupabaseDynamicDatabase>
> | null = null;
let usersColumnSetCache: Set<string> | null = null;

function asString(value: unknown) {
  return String(value || "").trim();
}

function getUserId(row: UserPayload) {
  return (
    asString(row.auth_user_id) ||
    asString(row.id) ||
    asString(row.userId) ||
    asString(row.user_id)
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
  const fallbackUsername =
    asString(row.username) ||
    (email ? email.split("@")[0] : `user_${row.id.slice(0, 8)}`);
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
    last_sign_in_at: asString(row.last_sign_in_at) || null,
    updated_at: updatedAt,
    updatedAt,
    source: "auth_only",
  };
}

function toNullableString(value: unknown) {
  const text = asString(value);
  return text.length > 0 ? text : null;
}

function normalizePendingUserRow(raw: Record<string, unknown> | null) {
  if (!raw) {
    return null;
  }

  const id = asString(raw.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: toNullableString(raw.email),
    username: toNullableString(raw.username),
    role_requested: toNullableString(raw.role_requested),
    status: toNullableString(raw.status),
    phone: toNullableString(raw.phone),
    company_name: toNullableString(raw.company_name),
    company_phone: toNullableString(raw.company_phone),
    is_company: typeof raw.is_company === "boolean" ? raw.is_company : null,
    password: toNullableString(raw.password),
    password_hash: toNullableString(raw.password_hash),
    auth_user_id: toNullableString(raw.auth_user_id),
  } satisfies PendingUserRow;
}

function normalizePendingStatus(value: string | null | undefined) {
  return asString(value).toLowerCase() || "pending";
}

function getDefaultUsername(email: string, fallbackId: string) {
  const candidate = email.split("@")[0] || "";
  const normalized = candidate.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  return `user_${fallbackId.slice(0, 8)}`;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function omitPayloadKeys(
  payload: Record<string, unknown>,
  keysToOmit: string[],
) {
  const next = { ...payload };
  for (const key of keysToOmit) {
    delete next[key];
  }
  return next;
}

function isMissingColumnError(error: unknown) {
  const dbError = error as DbErrorLike;
  const message = asString(dbError?.message).toLowerCase();
  return (
    dbError?.code === "42703" ||
    dbError?.code === "42P01" ||
    dbError?.code === "PGRST204" ||
    message.includes("column") ||
    message.includes("relation")
  );
}

function isAuthUserExistsError(error: unknown) {
  const message = asString((error as { message?: string })?.message).toLowerCase();
  return (
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user_already_exists") ||
    message.includes("duplicate key")
  );
}

function getSupabaseServiceClient() {
  if (!env.supabaseServiceRoleKey) {
    throw new ApiError(
      503,
      "SUPABASE_SERVICE_ROLE_KEY is required for approving account requests",
    );
  }

  if (!supabaseServiceClient) {
    supabaseServiceClient = createClient<SupabaseDynamicDatabase>(
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

async function getUsersColumnSet() {
  if (usersColumnSetCache) {
    return usersColumnSetCache;
  }

  const { rows } = await q<{ column_name: string }>(
    `
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
    `,
    [],
  );

  const columns = new Set(rows.map((row) => asString(row.column_name)));
  if (!columns.has("id")) {
    throw new ApiError(500, "public.users schema is missing required id column");
  }

  usersColumnSetCache = columns;
  return columns;
}

async function findAuthUserIdByEmailViaSupabase(email: string) {
  const serviceClient = getSupabaseServiceClient();
  const normalizedEmail = email.toLowerCase();
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      logger.warn("Unable to list auth users via Supabase Admin API", error);
      return null;
    }

    const users = data?.users || [];
    const matched = users.find(
      (user) => asString(user.email).toLowerCase() === normalizedEmail,
    );

    if (matched?.id) {
      return asString(matched.id) || null;
    }

    if (users.length < perPage) {
      break;
    }
  }

  return null;
}

async function listAuthUsersViaSupabase() {
  const serviceClient = getSupabaseServiceClient();
  const perPage = 200;
  const rows: AuthRow[] = [];

  for (let page = 1; page <= 200; page += 1) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new ApiError(
        500,
        error.message || "Failed to list auth users via Supabase Admin API",
      );
    }

    const users = data?.users || [];
    for (const user of users) {
      const metadata = (user.user_metadata || {}) as Record<string, unknown>;

      rows.push({
        id: asString(user.id),
        email: toNullableString(user.email),
        username: toNullableString(metadata.username),
        created_at: toNullableString(user.created_at),
        last_sign_in_at: toNullableString(user.last_sign_in_at),
      });
    }

    if (users.length < perPage) {
      break;
    }
  }

  return rows;
}

async function listPublicUsersViaSupabase() {
  const serviceClient = getSupabaseServiceClient();
  const { data, error } = await serviceClient.from("users").select("*");

  if (error) {
    throw new ApiError(
      500,
      error.message || "Failed to list users from Supabase",
    );
  }

  return (data || []) as UserPayload[];
}

async function getAuthUserByIdViaSupabase(authUserId: string) {
  const serviceClient = getSupabaseServiceClient();
  const normalizedId = asString(authUserId);
  if (!normalizedId) {
    return null;
  }

  const { data, error } = await serviceClient.auth.admin.getUserById(normalizedId);
  if (error || !data?.user) {
    return null;
  }

  const user = data.user;
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;

  return {
    id: asString(user.id),
    email: toNullableString(user.email),
    username: toNullableString(metadata.username),
    created_at: toNullableString(user.created_at),
    last_sign_in_at: toNullableString(user.last_sign_in_at),
  } satisfies AuthRow;
}

async function findAuthUserIdByEmail(email: string) {
  try {
    const { rows } = await q<{ id: string }>(
      `
      select id::text
      from auth.users
      where lower(email) = lower($1)
      order by created_at desc
      limit 1
      `,
      [email],
    );

    return asString(rows[0]?.id) || null;
  } catch (error) {
    logger.warn("Unable to query auth.users by email", error);
    return findAuthUserIdByEmailViaSupabase(email);
  }
}

async function syncAuthUserCredentials(authUserId: string, row: PendingUserRow) {
  const serviceClient = getSupabaseServiceClient();
  const email = asString(row.email).toLowerCase();
  const username = asString(row.username);
  const passwordHash = asString(row.password_hash);
  const plainPassword = asString(row.password);

  const updatePayload: {
    email?: string;
    email_confirm: boolean;
    user_metadata?: Record<string, unknown>;
    password_hash?: string;
    password?: string;
  } = {
    email_confirm: true,
  };

  if (email) {
    updatePayload.email = email;
  }

  if (username) {
    updatePayload.user_metadata = { username };
  }

  if (passwordHash) {
    updatePayload.password_hash = passwordHash;
  } else if (plainPassword) {
    updatePayload.password = plainPassword;
  }

  const { error } = await serviceClient.auth.admin.updateUserById(
    authUserId,
    updatePayload,
  );

  if (error) {
    logger.warn("Unable to sync existing auth user credentials", {
      authUserId,
      error: error.message,
    });
  }
}

async function ensureAuthUserForPendingRequest(row: PendingUserRow) {
  const email = asString(row.email).toLowerCase();
  if (!email) {
    throw badRequest("Pending request email is required");
  }

  const linkedAuthUserId = asString(row.auth_user_id);
  if (linkedAuthUserId) {
    await syncAuthUserCredentials(linkedAuthUserId, row);
    return linkedAuthUserId;
  }

  const existingAuthUserId = await findAuthUserIdByEmail(email);
  if (existingAuthUserId) {
    await syncAuthUserCredentials(existingAuthUserId, row);
    return existingAuthUserId;
  }

  const serviceClient = getSupabaseServiceClient();
  const passwordHash = asString(row.password_hash);
  const plainPassword = asString(row.password);
  const createPayload: {
    email: string;
    email_confirm: boolean;
    password?: string;
    password_hash?: string;
    user_metadata?: Record<string, unknown>;
  } = {
    email,
    email_confirm: true,
    user_metadata: {
      username: asString(row.username) || getDefaultUsername(email, randomUUID()),
    },
  };

  if (passwordHash) {
    createPayload.password_hash = passwordHash;
  } else if (plainPassword) {
    createPayload.password = plainPassword;
  } else {
    createPayload.password = `Temp#${randomUUID()}`;
  }

  const { data, error } = await serviceClient.auth.admin.createUser(createPayload);
  if (error) {
    if (isAuthUserExistsError(error)) {
      const existingAfterCreate = await findAuthUserIdByEmail(email);
      if (existingAfterCreate) {
        return existingAfterCreate;
      }
    }

    throw new ApiError(
      500,
      error.message || "Failed to provision auth user from pending request",
    );
  }

  const authUserId = asString(data.user?.id);
  if (!authUserId) {
    throw new ApiError(500, "Auth user provisioning returned empty user id");
  }

  return authUserId;
}

async function upsertPublicUserFromPendingRequest(
  authUserId: string,
  row: PendingUserRow,
) {
  try {
    const columns = await getUsersColumnSet();
    const email = asString(row.email).toLowerCase();
    if (!email) {
      throw badRequest("Pending request email is required");
    }

    const nowIso = new Date().toISOString();
    const roleMapping = mapRequestedRoleForPersistence(row.role_requested);
    const username =
      asString(row.username) || getDefaultUsername(email, authUserId);
    const phone =
      toNullableString(row.phone) || toNullableString(row.company_phone);
    const company =
      row.is_company === false ? null : toNullableString(row.company_name);

    const payload: Record<string, unknown> = {
      id: authUserId,
      email,
      username,
      phone,
      company,
      role: roleMapping.legacyRole,
      role_v2: roleMapping.roleV2,
      workspace_role: roleMapping.workspaceRole,
      status: "approved",
      access: "active",
      auth_user_id: authUserId,
      created_at: nowIso,
      updated_at: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const insertColumns = Object.keys(payload).filter((column) => columns.has(column));
    if (!insertColumns.includes("id")) {
      throw new ApiError(500, "public.users upsert cannot proceed without id column");
    }

    if (!insertColumns.includes("email")) {
      throw new ApiError(500, "public.users upsert cannot proceed without email column");
    }

    const updateColumns = insertColumns.filter(
      (column) => !["created_at", "createdAt"].includes(column),
    );
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(", ");
    const conflictSql =
      updateColumns.length > 0
        ? `on conflict (${quoteIdentifier("id")}) do update set ${updateColumns
            .map(
              (column) =>
                `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`,
            )
            .join(", ")}`
        : `on conflict (${quoteIdentifier("id")}) do nothing`;

    const insertSql = `
      insert into public.users (${insertColumns.map(quoteIdentifier).join(", ")})
      values (${placeholders})
      ${conflictSql}
    `;

    const insertParams = insertColumns.map((column) => payload[column]);

    try {
      await q(insertSql, insertParams);
      return;
    } catch (error) {
      const dbError = error as DbErrorLike;
      const isEmailConflict =
        dbError?.code === "23505" &&
        asString(dbError.message).toLowerCase().includes("email");

      if (!isEmailConflict) {
        throw error;
      }

      const updateColumnsByEmail = insertColumns.filter(
        (column) => !["email", "created_at", "createdAt"].includes(column),
      );
      if (updateColumnsByEmail.length === 0) {
        throw error;
      }

      const updateSql = `
        update public.users
        set ${updateColumnsByEmail
          .map((column, index) => `${quoteIdentifier(column)} = $${index + 2}`)
          .join(", ")}
        where lower(${quoteIdentifier("email")}) = lower($1)
      `;

      const updateParams = [
        email,
        ...updateColumnsByEmail.map((column) => payload[column]),
      ];
      const result = await q(updateSql, updateParams);

      if (!result.rowCount) {
        throw error;
      }
    }
  } catch (error) {
    logger.warn("public.users SQL upsert failed; switching to Supabase fallback", error);
    await upsertPublicUserViaSupabase(authUserId, row);
  }
}

async function getPendingUserByIdViaSupabase(pendingUserId: string) {
  const serviceClient = getSupabaseServiceClient();

  const selectVariants = [
    "id,email,username,role_requested,status,phone,company_name,company_phone,is_company,password,password_hash,auth_user_id",
    "id,email,username,role_requested,status,password_hash,auth_user_id",
    "id,email,username,role_requested,status,auth_user_id",
  ];

  let lastError: unknown = null;

  for (const selectClause of selectVariants) {
    try {
      const { data, error } = await serviceClient
        .from("pending_users")
        .select(selectClause)
        .eq("id", pendingUserId)
        .maybeSingle();

      if (!error) {
        return normalizePendingUserRow(
          (data || null) as Record<string, unknown> | null,
        );
      }

      lastError = error;
      if (!isMissingColumnError(error)) {
        throw error;
      }
    } catch (error) {
      lastError = error;
      if (!isMissingColumnError(error)) {
        throw new ApiError(
          500,
          asString((error as { message?: string })?.message) ||
            "Failed to load pending request",
        );
      }
    }
  }

  throw new ApiError(
    500,
    asString((lastError as { message?: string })?.message) ||
      "Failed to load pending request",
  );
}

async function upsertPublicUserViaSupabase(
  authUserId: string,
  row: PendingUserRow,
) {
  const serviceClient = getSupabaseServiceClient();
  const email = asString(row.email).toLowerCase();
  if (!email) {
    throw badRequest("Pending request email is required");
  }

  const nowIso = new Date().toISOString();
  const roleMapping = mapRequestedRoleForPersistence(row.role_requested);
  const username =
    asString(row.username) || getDefaultUsername(email, authUserId);
  const phone =
    toNullableString(row.phone) || toNullableString(row.company_phone);
  const company =
    row.is_company === false ? null : toNullableString(row.company_name);

  const variants: Array<Record<string, unknown>> = [
    {
      id: authUserId,
      email,
      username,
      phone,
      company,
      role: roleMapping.legacyRole,
      role_v2: roleMapping.roleV2,
      workspace_role: roleMapping.workspaceRole,
      status: "approved",
      access: "active",
      auth_user_id: authUserId,
      created_at: nowIso,
      updated_at: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: authUserId,
      email,
      username,
      phone,
      company,
      role: roleMapping.legacyRole,
      role_v2: roleMapping.roleV2,
      workspace_role: roleMapping.workspaceRole,
      status: "approved",
      access: "active",
      auth_user_id: authUserId,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: authUserId,
      email,
      username,
      phone,
      company,
      role: roleMapping.legacyRole,
      workspace_role: roleMapping.workspaceRole,
      status: "approved",
      access: "active",
    },
    {
      id: authUserId,
      email,
      role: roleMapping.legacyRole,
      workspace_role: roleMapping.workspaceRole,
    },
  ];

  let lastError: unknown = null;

  for (const payload of variants) {
    const { error } = await serviceClient
      .from("users")
      .upsert(payload, { onConflict: "id" });

    if (!error) {
      return;
    }

    lastError = error;

    const isEmailConflict =
      asString(error.message).toLowerCase().includes("duplicate key") &&
      asString(error.message).toLowerCase().includes("email");

    if (isEmailConflict) {
      const updatePayload = {
        ...payload,
        updated_at: nowIso,
        updatedAt: nowIso,
      };
      const { error: updateError } = await serviceClient
        .from("users")
        .update(updatePayload)
        .eq("email", email);

      if (!updateError) {
        return;
      }

      lastError = updateError;
    }

    if (!isMissingColumnError(error)) {
      break;
    }
  }

  throw new ApiError(
    500,
    asString((lastError as { message?: string })?.message) ||
      "Failed to upsert approved user profile",
  );
}

async function updatePendingStatusViaSupabase(params: {
  pendingUserId: string;
  reviewerId: string;
  nextStatus: "approved" | "declined";
  reason: string | null;
  authUserId?: string | null;
}) {
  const serviceClient = getSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const approveVariants: Array<Record<string, unknown>> = [];

  if (params.authUserId) {
    approveVariants.push({
      status: "approved",
      approved_by: params.reviewerId,
      approved_at: nowIso,
      notes: params.reason,
      auth_user_id: params.authUserId,
    });
    approveVariants.push({
      status: "approved",
      approved_by: params.reviewerId,
      approved_at: nowIso,
      auth_user_id: params.authUserId,
    });
    approveVariants.push({
      status: "approved",
      auth_user_id: params.authUserId,
    });
  }

  approveVariants.push(
    {
      status: "approved",
      approved_by: params.reviewerId,
      approved_at: nowIso,
      notes: params.reason,
    },
    {
      status: "approved",
      approved_by: params.reviewerId,
      approved_at: nowIso,
    },
    {
      status: "approved",
      notes: params.reason,
    },
    {
      status: "approved",
    },
  );

  const declineVariants: Array<Record<string, unknown>> = [
    {
      status: "declined",
      approved_by: params.reviewerId,
      approved_at: null,
      notes: params.reason || "Declined by admin",
    },
    {
      status: "declined",
      notes: params.reason || "Declined by admin",
    },
    {
      status: "declined",
    },
  ];

  const variants =
    params.nextStatus === "approved" ? approveVariants : declineVariants;

  let lastError: unknown = null;

  const attemptUpdate = async (
    payload: Record<string, unknown>,
    statusMode: "pending" | "null",
  ) => {
    let query = serviceClient.from("pending_users").update(payload).eq("id", params.pendingUserId);

    if (statusMode === "pending") {
      query = query.eq("status", "pending");
    } else {
      query = query.is("status", null);
    }

    return query.select("id,status").maybeSingle();
  };

  for (const payload of variants) {
    for (const statusMode of ["pending", "null"] as const) {
      const { data, error } = await attemptUpdate(payload, statusMode);

      if (!error && data) {
        return;
      }

      if (error) {
        lastError = error;
        if (!isMissingColumnError(error)) {
          throw new ApiError(
            500,
            error.message || `Failed to mark request as ${params.nextStatus}`,
          );
        }
      }
    }
  }

  if (lastError && !isMissingColumnError(lastError)) {
    throw new ApiError(
      500,
      asString((lastError as { message?: string })?.message) ||
        `Failed to mark request as ${params.nextStatus}`,
    );
  }

  const existing = await getPendingUserByIdViaSupabase(params.pendingUserId);
  if (!existing) {
    throw notFound("Pending request not found");
  }

  throw badRequest(
    `Pending request is already ${normalizePendingStatus(existing.status)}`,
  );
}

async function getPendingUserById(pendingUserId: string) {
  const selectBase = `
    select
      id::text as id,
      email::text as email,
      username::text as username,
      role_requested::text as role_requested,
      status::text as status
  `;

  try {
    const { rows } = await q<PendingUserRow>(
      `
      ${selectBase},
      password::text as password,
      phone::text as phone,
      company_name::text as company_name,
      company_phone::text as company_phone,
      is_company,
      auth_user_id::text as auth_user_id,
      password_hash::text as password_hash
      from public.pending_users
      where id::text = $1
      limit 1
      `,
      [pendingUserId],
    );

    return rows[0] || null;
  } catch (error) {
    if (!isMissingColumnError(error)) {
      logger.warn("Unable to query pending users from backend DB", error);
      return getPendingUserByIdViaSupabase(pendingUserId);
    }

    try {
      const { rows } = await q<PendingUserRow>(
        `
        ${selectBase},
        null::text as password,
        null::text as phone,
        null::text as company_name,
        null::text as company_phone,
        null::boolean as is_company,
        null::text as auth_user_id,
        null::text as password_hash
        from public.pending_users
        where id::text = $1
        limit 1
        `,
        [pendingUserId],
      );

      return rows[0] || null;
    } catch (fallbackError) {
      logger.warn("Unable to query pending users from backend DB", fallbackError);
      return getPendingUserByIdViaSupabase(pendingUserId);
    }
  }
}

async function updatePendingStatusOrThrow(params: {
  pendingUserId: string;
  reviewerId: string;
  nextStatus: "approved" | "declined";
  reason: string | null;
  authUserId?: string | null;
}) {
  try {
    if (params.nextStatus === "approved") {
      const result = await q(
        `
        update public.pending_users
        set
          status = 'approved',
          approved_by = $2,
          approved_at = now(),
          notes = $3
        where id::text = $1
          and coalesce(status, 'pending') = 'pending'
        `,
        [params.pendingUserId, params.reviewerId, params.reason],
      );

      if (result.rowCount && result.rowCount > 0) {
        return;
      }
    } else {
      const declineReason = params.reason || "Declined by admin";
      const result = await q(
        `
        update public.pending_users
        set
          status = 'declined',
          approved_by = $2,
          approved_at = null,
          notes = $3
        where id::text = $1
          and coalesce(status, 'pending') = 'pending'
        `,
        [params.pendingUserId, params.reviewerId, declineReason],
      );

      if (result.rowCount && result.rowCount > 0) {
        return;
      }
    }

    const existing = await getPendingUserById(params.pendingUserId);
    if (!existing) {
      throw notFound("Pending request not found");
    }

    throw badRequest(
      `Pending request is already ${normalizePendingStatus(existing.status)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.statusCode < 500) {
      throw error;
    }

    logger.warn("pending_users SQL update failed; switching to Supabase fallback", error);
    await updatePendingStatusViaSupabase(params);
  }
}

export async function listUsersService() {
  const byId = new Map<string, UserPayload>();
  const getMergeKey = (payload: UserPayload) => {
    const authUserId = asString(payload.auth_user_id);
    if (authUserId) {
      return authUserId;
    }

    const emailKey = asString(payload.email).toLowerCase();
    if (emailKey) {
      return emailKey;
    }

    return getUserId(payload);
  };

  const mergePublicRows = (
    rows: UserPayload[],
    options: { preferIncoming: boolean },
  ) => {
    for (const payload of rows) {
      const key = getMergeKey(payload || {});
      if (!key) continue;

      const existing = byId.get(key) || {};
      byId.set(
        key,
        options.preferIncoming
          ? { ...existing, ...payload }
          : { ...payload, ...existing },
      );
    }
  };

  try {
    const { rows: publicRows } = await q<{ payload: UserPayload }>(
      `select to_jsonb(u) as payload from public.users u`,
      [],
    );

    mergePublicRows(
      publicRows.map((row) => (row.payload || {}) as UserPayload),
      { preferIncoming: true },
    );
  } catch (error) {
    logger.warn("Unable to query public.users in listUsersService", error);
  }

  try {
    const supabasePublicRows = await listPublicUsersViaSupabase();
    mergePublicRows(supabasePublicRows, { preferIncoming: true });
  } catch (error) {
    logger.warn("Unable to list public.users via Supabase in listUsersService", error);
  }

  const mergeAuthRows = (authRows: AuthRow[]) => {
    for (const authRow of authRows) {
      const emailKey = asString(authRow.email).toLowerCase();
      const existing = byId.get(authRow.id) || (emailKey ? byId.get(emailKey) : undefined);
      if (existing) {
        if (!asString(existing.email) && asString(authRow.email)) {
          existing.email = asString(authRow.email);
        }
        if (!asString(existing.username) && asString(authRow.username)) {
          existing.username = asString(authRow.username);
        }
        if (!asString(existing.auth_user_id)) {
          existing.auth_user_id = authRow.id;
        }
        if (!asString(existing.last_sign_in_at) && asString(authRow.last_sign_in_at)) {
          existing.last_sign_in_at = asString(authRow.last_sign_in_at);
        }
        byId.set(authRow.id, existing);
        if (emailKey) {
          byId.set(emailKey, existing);
        }
        continue;
      }

      const authOnly = buildAuthOnlyUser(authRow);
      byId.set(authRow.id, authOnly);
      if (emailKey) {
        byId.set(emailKey, authOnly);
      }
    }
  };

  let authRowsFromSql: AuthRow[] | null = null;
  try {
    const { rows } = await q<AuthRow>(
      `
      select
        id::text,
        email,
        raw_user_meta_data->>'username' as username,
        created_at::text,
        last_sign_in_at::text
      from auth.users
      `,
      [],
    );

    authRowsFromSql = rows;
    mergeAuthRows(rows);
  } catch (error) {
    logger.warn("Unable to query auth.users in listUsersService", error);
  }

  if (!authRowsFromSql || authRowsFromSql.length === 0) {
    try {
      const authRowsFromSupabase = await listAuthUsersViaSupabase();
      mergeAuthRows(authRowsFromSupabase);
    } catch (error) {
      logger.warn("Unable to list auth users via Supabase in listUsersService", error);
    }
  }

  if (byId.size === 0) {
    logger.warn("listUsersService resolved no rows from any source");
    return [];
  }

  return Array.from(new Set(byId.values())).sort((a, b) =>
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

async function getPublicUserProfileForRoleChange(userId: string) {
  const normalizedUserId = asString(userId);
  if (!normalizedUserId) {
    return null;
  }

  const serviceClient = getSupabaseServiceClient();

  const byIdResult = await serviceClient
    .from("users")
    .select("*")
    .eq("id", normalizedUserId)
    .maybeSingle();

  if (!byIdResult.error && byIdResult.data) {
    return (byIdResult.data || null) as Record<string, unknown> | null;
  }

  if (byIdResult.error && !isMissingColumnError(byIdResult.error)) {
    throw new ApiError(
      500,
      byIdResult.error.message || "Failed to load target user profile",
    );
  }

  const byAuthUserIdResult = await serviceClient
    .from("users")
    .select("*")
    .eq("auth_user_id", normalizedUserId)
    .maybeSingle();

  if (!byAuthUserIdResult.error) {
    return (byAuthUserIdResult.data || null) as Record<string, unknown> | null;
  }

  if (!isMissingColumnError(byAuthUserIdResult.error)) {
    throw new ApiError(
      500,
      byAuthUserIdResult.error.message || "Failed to load target user profile",
    );
  }

  return null;
}

async function persistUserRoleProfileViaSupabase(params: {
  profileId: string;
  authUserId: string | null;
  email: string | null;
  username: string | null;
  roleMapping: RoleMapping;
  profileExists: boolean;
}) {
  const serviceClient = getSupabaseServiceClient();
  const nowIso = new Date().toISOString();

  const makePayload = (includeInsertTimestamps: boolean) => {
    const payload: Record<string, unknown> = {
      role: params.roleMapping.legacyRole,
      role_v2: params.roleMapping.roleV2,
      workspace_role: params.roleMapping.workspaceRole,
      status: "approved",
      access: "active",
      updated_at: nowIso,
      updatedAt: nowIso,
    };

    if (params.authUserId) {
      payload.auth_user_id = params.authUserId;
    }

    if (params.email) {
      payload.email = params.email;
    }

    if (params.username) {
      payload.username = params.username;
    }

    if (includeInsertTimestamps) {
      payload.created_at = nowIso;
      payload.createdAt = nowIso;
    }

    return payload;
  };

  const updateVariants: Array<Record<string, unknown>> = [
    makePayload(false),
    omitPayloadKeys(makePayload(false), ["workspace_role"]),
    {
      role: params.roleMapping.legacyRole,
      role_v2: params.roleMapping.roleV2,
      status: "approved",
      access: "active",
      updated_at: nowIso,
      updatedAt: nowIso,
    },
    {
      role: params.roleMapping.legacyRole,
      updated_at: nowIso,
      updatedAt: nowIso,
    },
  ];

  let lastError: unknown = null;

  if (params.profileExists) {
    for (const payload of updateVariants) {
      const { data, error } = await serviceClient
        .from("users")
        .update(payload)
        .eq("id", params.profileId)
        .select("id")
        .maybeSingle();

      if (!error && data) {
        return;
      }

      if (error) {
        lastError = error;
        if (!isMissingColumnError(error)) {
          throw new ApiError(
            500,
            error.message || "Failed to update target user role",
          );
        }
      }
    }
  }

  if (!params.email) {
    throw badRequest("Target user email is required to create profile");
  }

  const insertVariants: Array<Record<string, unknown>> = [
    {
      id: params.profileId,
      ...makePayload(true),
    },
    {
      id: params.profileId,
      ...omitPayloadKeys(makePayload(true), ["workspace_role", "createdAt"]),
    },
    {
      id: params.profileId,
      email: params.email,
      role: params.roleMapping.legacyRole,
      role_v2: params.roleMapping.roleV2,
      status: "approved",
      access: "active",
      updated_at: nowIso,
      updatedAt: nowIso,
    },
    {
      id: params.profileId,
      email: params.email,
      role: params.roleMapping.legacyRole,
    },
  ];

  for (const payload of insertVariants) {
    const { error } = await serviceClient
      .from("users")
      .upsert(payload, { onConflict: "id" });

    if (!error) {
      return;
    }

    lastError = error;

    const isEmailConflict =
      asString(error.message).toLowerCase().includes("duplicate key") &&
      asString(error.message).toLowerCase().includes("email");

    if (isEmailConflict && params.email) {
      const { error: updateByEmailError } = await serviceClient
        .from("users")
        .update({
          ...payload,
          updated_at: nowIso,
          updatedAt: nowIso,
        })
        .eq("email", params.email);

      if (!updateByEmailError) {
        return;
      }

      lastError = updateByEmailError;
    }

    if (!isMissingColumnError(error)) {
      break;
    }
  }

  throw new ApiError(
    500,
    asString((lastError as { message?: string })?.message) ||
      "Failed to persist user role profile",
  );
}

export async function changeUserRoleService(
  user: AuthUser,
  targetUserId: string,
  requestedRole: string,
) {
  const normalizedTargetUserId = asString(targetUserId);
  if (!normalizedTargetUserId) {
    throw badRequest("id is required");
  }

  const roleMapping = mapRequestedRoleForPersistence(requestedRole);
  const existingProfile = await getPublicUserProfileForRoleChange(normalizedTargetUserId);

  let authRow = await getAuthUserByIdViaSupabase(normalizedTargetUserId);
  if (!authRow && existingProfile) {
    const fallbackAuthUserId = asString(existingProfile.auth_user_id);
    if (fallbackAuthUserId) {
      authRow = await getAuthUserByIdViaSupabase(fallbackAuthUserId);
    }
  }

  if (!existingProfile && !authRow) {
    throw notFound("User not found");
  }

  const profileId =
    asString(existingProfile?.id) ||
    asString(authRow?.id) ||
    normalizedTargetUserId;
  const authUserId =
    asString(authRow?.id) ||
    asString(existingProfile?.auth_user_id) ||
    null;
  const email =
    toNullableString(authRow?.email) ||
    toNullableString(existingProfile?.email);

  const username =
    toNullableString(existingProfile?.username) ||
    toNullableString(authRow?.username) ||
    (email ? getDefaultUsername(email, profileId) : null);

  await persistUserRoleProfileViaSupabase({
    profileId,
    authUserId,
    email,
    username,
    roleMapping,
    profileExists: Boolean(existingProfile),
  });

  logger.info("audit.user.role.changed", {
    changedBy: user.id,
    requestedUserId: normalizedTargetUserId,
    profileId,
    authUserId,
    workspaceRole: roleMapping.workspaceRole,
    roleV2: roleMapping.roleV2,
  });

  return {
    id: profileId,
    authUserId,
    role: roleMapping.workspaceRole,
    roleV2: roleMapping.roleV2,
  };
}

export async function approvePendingUserService(
  user: AuthUser,
  pendingUserId: string,
  reason: string | null,
) {
  const normalizedId = asString(pendingUserId);
  if (!normalizedId) {
    throw badRequest("pendingUserId is required");
  }

  const pendingUser = await getPendingUserById(normalizedId);
  if (!pendingUser) {
    throw notFound("Pending request not found");
  }

  const currentStatus = normalizePendingStatus(pendingUser.status);
  if (currentStatus !== "pending") {
    throw badRequest(`Pending request is already ${currentStatus}`);
  }

  const authUserId = await ensureAuthUserForPendingRequest(pendingUser);
  await upsertPublicUserFromPendingRequest(authUserId, pendingUser);
  await updatePendingStatusOrThrow({
    pendingUserId: normalizedId,
    reviewerId: user.id,
    nextStatus: "approved",
    reason: asString(reason) || null,
    authUserId,
  });

  try {
    await enqueuePendingUserDecisionEmail({
      pendingUserId: normalizedId,
      recipientEmail: pendingUser.email,
      status: "approved",
      reason: asString(reason) || null,
    });
  } catch (error) {
    logger.warn("notification.pending_user.approved.enqueue_failed", {
      pendingUserId: normalizedId,
      error,
    });
  }

  logger.info("audit.pending_user.approved", {
    pendingUserId: normalizedId,
    email: pendingUser.email,
    approvedBy: user.id,
    authUserId,
  });

  return { id: normalizedId, authUserId };
}

export async function declinePendingUserService(
  user: AuthUser,
  pendingUserId: string,
  reason: string | null,
) {
  const normalizedId = asString(pendingUserId);
  if (!normalizedId) {
    throw badRequest("pendingUserId is required");
  }

  const pendingUser = await getPendingUserById(normalizedId);
  if (!pendingUser) {
    throw notFound("Pending request not found");
  }

  const currentStatus = normalizePendingStatus(pendingUser.status);
  if (currentStatus !== "pending") {
    throw badRequest(`Pending request is already ${currentStatus}`);
  }

  await updatePendingStatusOrThrow({
    pendingUserId: normalizedId,
    reviewerId: user.id,
    nextStatus: "declined",
    reason: asString(reason) || null,
  });

  try {
    await enqueuePendingUserDecisionEmail({
      pendingUserId: normalizedId,
      recipientEmail: pendingUser.email,
      status: "declined",
      reason: asString(reason) || null,
    });
  } catch (error) {
    logger.warn("notification.pending_user.declined.enqueue_failed", {
      pendingUserId: normalizedId,
      error,
    });
  }

  logger.info("audit.pending_user.declined", {
    pendingUserId: normalizedId,
    email: pendingUser.email,
    declinedBy: user.id,
  });

  return { id: normalizedId };
}

export async function sendAdminTestEmailService(user: AuthUser, recipientEmail: string) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Only admin or manager can send test emails");
  }

  const normalizedRecipient = asString(recipientEmail).toLowerCase();
  if (!normalizedRecipient || !normalizedRecipient.includes("@")) {
    throw badRequest("Valid recipient email is required");
  }

  const queued = await enqueueAdminTestEmail({
    recipientEmail: normalizedRecipient,
    requestedByUserId: user.id,
  });

  return {
    queued,
    recipientEmail: normalizedRecipient,
    message: queued
      ? "Test email queued successfully"
      : "Test email was not queued (notifications disabled or invalid recipient)",
  };
}
