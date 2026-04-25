import { Router } from "express";
import {
  approveTaskController,
  createTaskController,
  listAllTasksController,
  listMyTasksController,
  listTaskAssigneesController,
  updateTaskController,
} from "./globalTasks.controller.js";

export const globalTasksRouter = Router();

globalTasksRouter.get("/assignees", listTaskAssigneesController);
globalTasksRouter.get("/my", listMyTasksController);
globalTasksRouter.get("/", listAllTasksController);
globalTasksRouter.post("/", createTaskController);
globalTasksRouter.patch("/:id", updateTaskController);
globalTasksRouter.post("/:id/approve", approveTaskController);
