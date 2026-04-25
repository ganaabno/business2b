import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { badRequest } from "../../shared/http/errors.js";
import {
  approvePendingUserService,
  changeUserRoleService,
  declinePendingUserService,
  listPendingUsersService,
  listUsersService,
  sendAdminTestEmailService,
} from "./users.service.js";

function getParam(value: unknown) {
  const text = String(value || "").trim();
  if (!text) {
    throw badRequest("id is required");
  }
  return text;
}

function parseReason(body: unknown) {
  const payload = (body || {}) as Record<string, unknown>;
  const reason = payload.reason ? String(payload.reason).trim() : null;

  if (reason && reason.length > 500) {
    throw badRequest("reason must be 500 characters or fewer");
  }

  return reason;
}

function parseRole(body: unknown) {
  const payload = (body || {}) as Record<string, unknown>;
  const role = String(payload.role || "").trim().toLowerCase();

  if (!role) {
    throw badRequest("role is required");
  }

  const allowed = new Set([
    "user",
    "subcontractor",
    "provider",
    "agent",
    "manager",
    "admin",
    "superadmin",
  ]);

  if (!allowed.has(role)) {
    throw badRequest(
      "role must be one of: user, subcontractor, provider, agent, manager, admin, superadmin",
    );
  }

  return role;
}

function parseRecipientEmail(body: unknown) {
  const payload = (body || {}) as Record<string, unknown>;
  const recipientEmail = String(payload.recipientEmail || "").trim().toLowerCase();
  if (!recipientEmail || !recipientEmail.includes("@")) {
    throw badRequest("recipientEmail is required");
  }
  return recipientEmail;
}

export const listUsersController = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listUsersService();
  res.json({ data });
});

export const listPendingUsersController = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listPendingUsersService();
  res.json({ data });
});

export const approvePendingUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await approvePendingUserService(
      req.user!,
      getParam(req.params.id),
      parseReason(req.body),
    );
    res.json({ data });
  },
);

export const declinePendingUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await declinePendingUserService(
      req.user!,
      getParam(req.params.id),
      parseReason(req.body),
    );
    res.json({ data });
  },
);

export const changeUserRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await changeUserRoleService(
      req.user!,
      getParam(req.params.id),
      parseRole(req.body),
    );
    res.json({ data });
  },
);

export const sendAdminTestEmailController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await sendAdminTestEmailService(
      req.user!,
      parseRecipientEmail(req.body),
    );
    res.json({ data });
  },
);
