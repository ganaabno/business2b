import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import {
  addMemberService,
  createOrganizationService,
  getOrganizationService,
} from "./organizations.service.js";
import {
  parseAddMemberInput,
  parseCreateOrganizationInput,
} from "./organizations.schema.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value || "";

export const createOrganizationController = asyncHandler(async (req: Request, res: Response) => {
  const input = parseCreateOrganizationInput(req.body);
  const org = await createOrganizationService(req.user!, input);
  res.status(201).json({ data: org });
});

export const getOrganizationController = asyncHandler(async (req: Request, res: Response) => {
  const org = await getOrganizationService(req.user!, getParam(req.params.id));
  res.json({ data: org });
});

export const addOrganizationMemberController = asyncHandler(async (req: Request, res: Response) => {
  const input = parseAddMemberInput(req.body);
  await addMemberService(req.user!, getParam(req.params.id), input);
  res.status(204).send();
});
