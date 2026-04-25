import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import { listMonitoringRowsController } from "./monitoring.controller.js";

export const monitoringRouter = Router();

monitoringRouter.get("/seat-requests", authorize("payments:monitor"), listMonitoringRowsController);
