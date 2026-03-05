import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { listMonitoringRowsService } from "./monitoring.service.js";

export const listMonitoringRowsController = asyncHandler(async (req: Request, res: Response) => {
  const data = await listMonitoringRowsService(req.user!, {
    destination: typeof req.query.destination === "string" ? req.query.destination : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    organizationId: typeof req.query.organizationId === "string" ? req.query.organizationId : undefined,
    paymentState: typeof req.query.paymentState === "string" ? req.query.paymentState : undefined,
  });
  res.json({ data });
});
