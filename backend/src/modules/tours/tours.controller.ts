import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { parseSyncGlobalToursInput } from "./tours.schema.js";
import { searchToursService, syncGlobalToursService } from "./tours.service.js";

export const searchToursController = asyncHandler(async (req: Request, res: Response) => {
  const data = await searchToursService(req.query as Record<string, unknown>);
  res.json({ data });
});

export const syncGlobalToursController = asyncHandler(async (req: Request, res: Response) => {
  const input = parseSyncGlobalToursInput(req.body);
  const data = await syncGlobalToursService(req.user!, input);
  res.json({ data });
});
