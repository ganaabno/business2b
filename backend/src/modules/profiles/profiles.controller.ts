import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { getProfileOverviewService } from "./profiles.service.js";

export const getProfileOverviewController = asyncHandler(async (req: Request, res: Response) => {
  const data = await getProfileOverviewService(req.user!);
  res.json({ data });
});
