import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import {
  approveBindingRequestController,
  listBindingRequestsController,
  rejectBindingRequestController,
  submitBindingRequestController,
} from "./bindingRequests.controller.js";

export const bindingRequestsRouter = Router();

bindingRequestsRouter.post("/", authorize("bindingRequest:create"), submitBindingRequestController);
bindingRequestsRouter.get("/", listBindingRequestsController);
bindingRequestsRouter.post("/:id/approve", authorize("bindingRequest:approve"), approveBindingRequestController);
bindingRequestsRouter.post("/:id/reject", authorize("bindingRequest:reject"), rejectBindingRequestController);
