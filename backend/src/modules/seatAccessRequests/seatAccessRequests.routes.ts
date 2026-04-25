import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import {
  approveSeatAccessRequestController,
  listSeatAccessRequestsController,
  previewSeatAccessSerialSelectionController,
  rejectSeatAccessRequestController,
  selectTourFromSeatAccessRequestController,
  submitSeatAccessRequestController,
} from "./seatAccessRequests.controller.js";

export const seatAccessRequestsRouter = Router();

seatAccessRequestsRouter.post(
  "/",
  authorize("seatAccessRequest:create"),
  submitSeatAccessRequestController,
);
seatAccessRequestsRouter.get("/", listSeatAccessRequestsController);
seatAccessRequestsRouter.post(
  "/:id/approve",
  authorize("seatAccessRequest:approve"),
  approveSeatAccessRequestController,
);
seatAccessRequestsRouter.post(
  "/:id/reject",
  authorize("seatAccessRequest:reject"),
  rejectSeatAccessRequestController,
);
seatAccessRequestsRouter.post(
  "/:id/select-tour",
  authorize("seatAccessRequest:selectTour"),
  selectTourFromSeatAccessRequestController,
);
seatAccessRequestsRouter.post(
  "/:id/serial-preview",
  authorize("seatAccessRequest:selectTour"),
  previewSeatAccessSerialSelectionController,
);
