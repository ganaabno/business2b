import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { q } from "../../db/transaction.js";
import { badRequest, forbidden, unauthorized } from "../../shared/http/errors.js";
import { logger } from "../../shared/logger.js";
import type { AppRole } from "../../shared/types/auth.js";

const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { persistSession: false },
});

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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseActingRole(value: string): AppRole {
  const role = String(value || "").trim().toLowerCase();
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
    default:
      throw badRequest(
        "x-acting-role must be one of: admin, manager, subcontractor|user, agent|provider",
      );
  }
}

function normalizeIp(ip: string) {
  const value = ip.trim();
  if (value.startsWith("::ffff:")) {
    return value.slice(7);
  }
  return value;
}

function isIpAllowlisted(ip: string) {
  if (env.b2bAdminTestModeIpAllowlist.length === 0) {
    return true;
  }

  const normalizedIp = normalizeIp(ip);
  return env.b2bAdminTestModeIpAllowlist.some(
    (candidate) => normalizeIp(candidate) === normalizedIp,
  );
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

    const userId = data.user.id;
    const { rows } = await q<{ payload: Record<string, unknown> }>(
      `
      select to_jsonb(u) as payload
      from public.users u
      where u.id::text = $1::text
      limit 1
      `,
      [userId],
    );

    if (rows.length === 0) {
      throw unauthorized("User profile not found");
    }

    const payload = rows[0].payload || {};
    const roleV2 = String(payload.role_v2 || "").trim();
    const legacyRole = String(payload.role || "").trim();

    let primaryOrganizationId: string | null = null;
    try {
      const { rows: orgRows } = await q<{ organization_id: string | null }>(
        `
        select om.organization_id::text as organization_id
        from public.organization_members om
        where om.user_id::text = $1::text and om.is_primary = true
        limit 1
        `,
        [userId],
      );
      primaryOrganizationId = orgRows[0]?.organization_id || null;
    } catch (error) {
      logger.warn("auth.requireAuth organization lookup failed; continuing without org context", {
        error,
      });
    }

    const actorRole = normalizeRole(roleV2 || legacyRole);
    let effectiveRole: AppRole = actorRole;
    let effectiveOrganizationId: string | null = primaryOrganizationId;
    let adminTestModeActive = false;

    const actingRoleHeader =
      typeof req.headers["x-acting-role"] === "string"
        ? req.headers["x-acting-role"]
        : "";
    const actingOrganizationHeader =
      typeof req.headers["x-acting-org-id"] === "string"
        ? req.headers["x-acting-org-id"]
        : "";

    const hasOverrideHeader =
      actingRoleHeader.trim().length > 0 || actingOrganizationHeader.trim().length > 0;

    if (hasOverrideHeader) {
      if (!env.b2bAdminTestModeEnabled || env.isProduction) {
        throw forbidden("Admin test mode is disabled");
      }

      if (!(actorRole === "admin" || actorRole === "manager")) {
        throw forbidden("Only admin or manager can use admin test mode");
      }

      if (!isIpAllowlisted(req.ip || "")) {
        throw forbidden("Admin test mode is not allowed from this IP");
      }

      if (actingRoleHeader.trim().length > 0) {
        effectiveRole = parseActingRole(actingRoleHeader);
      }

      if (actingOrganizationHeader.trim().length > 0) {
        const organizationId = actingOrganizationHeader.trim();
        if (!UUID_PATTERN.test(organizationId)) {
          throw badRequest("x-acting-org-id must be a valid UUID");
        }
        effectiveOrganizationId = organizationId;
      }

      adminTestModeActive = true;
      logger.warn("audit.auth.admin_test_mode.override", {
        actorUserId: userId,
        actorRole,
        effectiveRole,
        effectiveOrganizationId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
      });
    }

    req.user = {
      id: userId,
      role: effectiveRole,
      organizationId: effectiveOrganizationId,
      actorId: userId,
      actorRole,
      isAdminTestMode: adminTestModeActive,
    };

    next();
  } catch (error) {
    next(error);
  }
}
