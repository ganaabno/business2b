import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import {
  addOrganizationMemberController,
  createOrganizationController,
  getOrganizationController,
} from "./organizations.controller.js";

export const organizationsRouter = Router();

organizationsRouter.post("/", authorize("organizations:create"), createOrganizationController);
organizationsRouter.get("/:id", getOrganizationController);
organizationsRouter.post("/:id/members", addOrganizationMemberController);
