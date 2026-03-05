import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import {
  canConvertToBooking,
  approveSeatRequestService,
  cancelSeatRequestService,
  createSeatRequestService,
  getSeatRequestService,
  listSeatRequestsService,
  rejectSeatRequestService,
} from "./seatRequests.service.js";
import {
  parseCreateSeatRequestInput,
  parseDecisionInput,
} from "./seatRequests.schema.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

export const createSeatRequestController = asyncHandler(async (req: Request, res: Response) => {
  const input = parseCreateSeatRequestInput(req.body);
  const created = await createSeatRequestService(req.user!, input);
  res.status(201).json({ data: created });
});

export const listSeatRequestsController = asyncHandler(async (req: Request, res: Response) => {
  const data = await listSeatRequestsService(req.user!, {
    destination: typeof req.query.destination === "string" ? req.query.destination : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    organizationId: typeof req.query.organizationId === "string" ? req.query.organizationId : undefined,
    paymentState: typeof req.query.paymentState === "string" ? req.query.paymentState : undefined,
  });
  res.json({ data });
});

export const getSeatRequestController = asyncHandler(async (req: Request, res: Response) => {
  const data = await getSeatRequestService(req.user!, getParam(req.params.id));
  res.json({ data });
});

export const approveSeatRequestController = asyncHandler(async (req: Request, res: Response) => {
  const { note } = parseDecisionInput(req.body);
  await approveSeatRequestService(req.user!, getParam(req.params.id), note);
  res.status(204).send();
});

export const rejectSeatRequestController = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = parseDecisionInput(req.body);
  await rejectSeatRequestService(req.user!, getParam(req.params.id), reason);
  res.status(204).send();
});

export const cancelSeatRequestController = asyncHandler(async (req: Request, res: Response) => {
  await cancelSeatRequestService(req.user!, getParam(req.params.id));
  res.status(204).send();
});

export const seatRequestBookingEligibilityController = asyncHandler(async (req: Request, res: Response) => {
  const requestId = getParam(req.params.id);
  const data = await getSeatRequestService(req.user!, requestId);
  const canBook = await canConvertToBooking(requestId);
  res.json({
    data: {
      seatRequestId: requestId,
      status: data.status,
      canBook,
      blocked: !canBook,
    },
  });
});
