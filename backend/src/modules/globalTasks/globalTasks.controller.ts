import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import {
  parseCreateGlobalTaskInput,
  parseGlobalTaskId,
  parseUpdateGlobalTaskInput,
} from "./globalTasks.schema.js";
import {
  approveTaskService,
  createTaskService,
  listAllTasksService,
  listMyTasksService,
  listTaskAssigneesService,
  updateTaskService,
} from "./globalTasks.service.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

export const listTaskAssigneesController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await listTaskAssigneesService(req.user!);
    res.json({ data });
  },
);

export const listMyTasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await listMyTasksService(req.user!);
    res.json({ data });
  },
);

export const listAllTasksController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await listAllTasksService(req.user!);
    res.json({ data });
  },
);

export const createTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseCreateGlobalTaskInput(req.body);
    const data = await createTaskService(req.user!, input);
    res.status(201).json({ data });
  },
);

export const updateTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const taskId = parseGlobalTaskId(getParam(req.params.id));
    const input = parseUpdateGlobalTaskInput(req.body);
    const data = await updateTaskService(req.user!, taskId, input);
    res.json({ data });
  },
);

export const approveTaskController = asyncHandler(
  async (req: Request, res: Response) => {
    const taskId = parseGlobalTaskId(getParam(req.params.id));
    const data = await approveTaskService(req.user!, taskId);
    res.json({ data });
  },
);
