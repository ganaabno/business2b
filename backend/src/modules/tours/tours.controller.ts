import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import {
  parseEnsureGlobalTourBookableInput,
  parseListTourDestinationsFilters,
  parsePushGlobalTourInput,
  parseSyncGlobalPriceRowCanonicalInput,
  parseSyncGlobalPriceRowInput,
  parseSyncGlobalToursInput,
} from "./tours.schema.js";
import {
  ensureGlobalTourBookableService,
  getGlobalOrdersProxyPayloadService,
  getGlobalToursProxyPayloadService,
  getGlobalToursSyncStatusService,
  listTourDestinationsService,
  pushGlobalTourService,
  searchToursService,
  syncGlobalPriceRowCanonicalService,
  syncGlobalPriceRowService,
  syncGlobalToursService,
} from "./tours.service.js";

export const listTourDestinationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const filters = parseListTourDestinationsFilters(
      req.query as Record<string, unknown>,
    );
    const data = await listTourDestinationsService(filters);
    res.json({ data });
  },
);

export const searchToursController = asyncHandler(async (req: Request, res: Response) => {
  const data = await searchToursService(req.user!, req.query as Record<string, unknown>);
  res.json({ data });
});

export const syncGlobalToursController = asyncHandler(async (req: Request, res: Response) => {
  const input = parseSyncGlobalToursInput(req.body);
  const data = await syncGlobalToursService(req.user!, input);
  res.json({ data });
});

export const getGlobalToursSyncStatusController = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getGlobalToursSyncStatusService();
    res.json({ data });
  },
);

export const getGlobalToursProxyController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getGlobalToursProxyPayloadService(req.user!);
    res.json({ data });
  },
);

export const getGlobalOrdersProxyController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await getGlobalOrdersProxyPayloadService(req.user!);
    res.json({ data });
  },
);

export const pushGlobalTourController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parsePushGlobalTourInput(req.body);
    const data = await pushGlobalTourService(req.user!, input);
    res.json({ data });
  },
);

export const syncGlobalPriceRowController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseSyncGlobalPriceRowInput(req.body);
    const data = await syncGlobalPriceRowService(req.user!, input);
    res.json({ data });
  },
);

export const syncGlobalPriceRowCanonicalController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseSyncGlobalPriceRowCanonicalInput(req.body);
    const data = await syncGlobalPriceRowCanonicalService(req.user!, input);
    res.json({ data });
  },
);

export const ensureGlobalTourBookableController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseEnsureGlobalTourBookableInput(req.body);
    const data = await ensureGlobalTourBookableService(req.user!, input);
    res.json({ data });
  },
);
