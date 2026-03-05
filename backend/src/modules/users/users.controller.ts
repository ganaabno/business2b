import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { listPendingUsersService, listUsersService } from "./users.service.js";

export const listUsersController = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listUsersService();
  res.json({ data });
});

export const listPendingUsersController = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listPendingUsersService();
  res.json({ data });
});
