import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import {
  approvePendingUserController,
  changeUserRoleController,
  declinePendingUserController,
  listPendingUsersController,
  listUsersController,
  sendAdminTestEmailController,
} from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/", authorize("users:view"), listUsersController);
usersRouter.get("/pending", authorize("users:view"), listPendingUsersController);
usersRouter.post(
  "/pending/:id/approve",
  authorize("users:manage"),
  approvePendingUserController,
);
usersRouter.post(
  "/pending/:id/decline",
  authorize("users:manage"),
  declinePendingUserController,
);
usersRouter.patch(
  "/:id/role",
  authorize("users:manage"),
  changeUserRoleController,
);
usersRouter.post(
  "/notifications/test-email",
  authorize("users:manage"),
  sendAdminTestEmailController,
);
