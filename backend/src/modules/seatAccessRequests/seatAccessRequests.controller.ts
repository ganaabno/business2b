import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import {
  approveSeatAccessRequestService,
  listSeatAccessRequestsService,
  rejectSeatAccessRequestService,
  selectTourFromSeatAccessRequestService,
  submitSeatAccessRequestService,
} from "./seatAccessRequests.service.js";
import {
  parseCreateSeatAccessRequestInput,
  parseSeatAccessDecisionInput,
  parseSeatAccessRequestListFilters,
  parseSelectTourFromAccessInput,
} from "./seatAccessRequests.schema.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

export const submitSeatAccessRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseCreateSeatAccessRequestInput(req.body);
    const data = await submitSeatAccessRequestService(req.user!, input);
    res.status(201).json({ data });
  },
);

export const listSeatAccessRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const filters = parseSeatAccessRequestListFilters(req.query as Record<string, unknown>);
    const data = await listSeatAccessRequestsService(req.user!, filters);
    res.json({ data });
  },
);

export const approveSeatAccessRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const { reason } = parseSeatAccessDecisionInput(req.body);
    const data = await approveSeatAccessRequestService(req.user!, getParam(req.params.id), reason);
    res.json({ data });
  },
);

export const rejectSeatAccessRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const { reason } = parseSeatAccessDecisionInput(req.body);
    const data = await rejectSeatAccessRequestService(req.user!, getParam(req.params.id), reason);
    res.json({ data });
  },
);

export const selectTourFromSeatAccessRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseSelectTourFromAccessInput(req.body);
    const data = await selectTourFromSeatAccessRequestService(
      req.user!,
      getParam(req.params.id),
      input,
    );
    res.status(201).json({ data });
  },
);
