import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import {
  approveBindingRequestService,
  listBindingRequestsService,
  rejectBindingRequestService,
  submitBindingRequestService,
} from "./bindingRequests.service.js";
import {
  parseBindingDecisionInput,
  parseBindingListFilters,
  parseCreateBindingRequestInput,
} from "./bindingRequests.schema.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

export const submitBindingRequestController = asyncHandler(async (req: Request, res: Response) => {
  const input = parseCreateBindingRequestInput(req.body);
  const data = await submitBindingRequestService(req.user!, input);
  res.status(201).json({ data });
});

export const listBindingRequestsController = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseBindingListFilters(req.query as Record<string, unknown>);
  const data = await listBindingRequestsService(req.user!, filters);
  res.json({ data });
});

export const approveBindingRequestController = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = parseBindingDecisionInput(req.body);
  const data = await approveBindingRequestService(req.user!, getParam(req.params.id), reason);
  res.json({ data });
});

export const rejectBindingRequestController = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = parseBindingDecisionInput(req.body);
  const data = await rejectBindingRequestService(req.user!, getParam(req.params.id), reason);
  res.json({ data });
});
