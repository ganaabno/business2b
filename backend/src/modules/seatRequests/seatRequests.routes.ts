import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import {
  approveSeatRequestController,
  cancelSeatRequestController,
  createSeatRequestController,
  getSeatRequestController,
  listSeatRequestsController,
  rejectSeatRequestController,
  seatRequestBookingEligibilityController,
} from "./seatRequests.controller.js";

export const seatRequestsRouter = Router();

seatRequestsRouter.post("/", authorize("seatRequest:create"), createSeatRequestController);
seatRequestsRouter.get("/", listSeatRequestsController);
seatRequestsRouter.get("/:id", getSeatRequestController);
seatRequestsRouter.get("/:id/booking-eligibility", seatRequestBookingEligibilityController);
seatRequestsRouter.post("/:id/approve", authorize("seatRequest:approve"), approveSeatRequestController);
seatRequestsRouter.post("/:id/reject", authorize("seatRequest:reject"), rejectSeatRequestController);
seatRequestsRouter.post("/:id/cancel", cancelSeatRequestController);
