import { Router } from "express";
import { authorize } from "../rbac/authorize.js";
import { listPendingUsersController, listUsersController } from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/", authorize("users:view:all"), listUsersController);
usersRouter.get("/pending", authorize("users:view:all"), listPendingUsersController);
