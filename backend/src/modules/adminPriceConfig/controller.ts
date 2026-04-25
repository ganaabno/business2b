import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { badRequest, notFound } from "../../shared/http/errors.js";
import { adminPriceConfigService } from "./service.js";
import {
  destinationSchema,
  priceConfigSchema,
  carTypeSchema,
  flightClassSchema,
  visaFeeSchema,
  optionalActivitySchema,
  seasonalPricingSchema,
  updateDestinationSchema,
  updatePriceConfigSchema,
  updateCarTypeSchema,
  updateFlightClassSchema,
  updateVisaFeeSchema,
  updateOptionalActivitySchema,
  updateSeasonalPricingSchema,
} from "./schema.js";

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    throw badRequest(firstError?.message || "Invalid data");
  }
  return result.data;
}

function parseQueryString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0] as string;
  return typeof value === 'string' ? value : undefined;
}

export const listDestinationsController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const data = await adminPriceConfigService.listDestinations(isActive);
    res.json({ data });
  }
);

export const getDestinationController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const data = await adminPriceConfigService.getDestination(id);
    if (!data) throw notFound("Destination not found");
    res.json({ data });
  }
);

export const createDestinationController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(destinationSchema, req.body);
    const data = await adminPriceConfigService.createDestination(input);
    res.status(201).json({ data });
  }
);

export const updateDestinationController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updateDestinationSchema, req.body);
    const data = await adminPriceConfigService.updateDestination(id, input);
    if (!data) throw notFound("Destination not found");
    res.json({ data });
  }
);

export const deleteDestinationController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deleteDestination(id);
    if (!success) throw notFound("Destination not found");
    res.json({ success: true });
  }
);

export const listPriceConfigsController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const data = await adminPriceConfigService.listPriceConfigs(isActive);
    res.json({ data });
  }
);

export const createPriceConfigController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(priceConfigSchema, req.body);
    const data = await adminPriceConfigService.createPriceConfig(input);
    res.status(201).json({ data });
  }
);

export const updatePriceConfigController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updatePriceConfigSchema, req.body);
    const data = await adminPriceConfigService.updatePriceConfig(id, input);
    if (!data) throw notFound("Price config not found");
    res.json({ data });
  }
);

export const deletePriceConfigController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deletePriceConfig(id);
    if (!success) throw notFound("Price config not found");
    res.json({ success: true });
  }
);

export const listCarTypesController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const data = await adminPriceConfigService.listCarTypes(isActive);
    res.json({ data });
  }
);

export const createCarTypeController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(carTypeSchema, req.body);
    const data = await adminPriceConfigService.createCarType(input);
    res.status(201).json({ data });
  }
);

export const updateCarTypeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updateCarTypeSchema, req.body);
    const data = await adminPriceConfigService.updateCarType(id, input);
    if (!data) throw notFound("Car type not found");
    res.json({ data });
  }
);

export const deleteCarTypeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deleteCarType(id);
    if (!success) throw notFound("Car type not found");
    res.json({ success: true });
  }
);

export const listFlightClassesController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const data = await adminPriceConfigService.listFlightClasses(isActive);
    res.json({ data });
  }
);

export const createFlightClassController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(flightClassSchema, req.body);
    const data = await adminPriceConfigService.createFlightClass(input);
    res.status(201).json({ data });
  }
);

export const updateFlightClassController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updateFlightClassSchema, req.body);
    const data = await adminPriceConfigService.updateFlightClass(id, input);
    if (!data) throw notFound("Flight class not found");
    res.json({ data });
  }
);

export const deleteFlightClassController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deleteFlightClass(id);
    if (!success) throw notFound("Flight class not found");
    res.json({ success: true });
  }
);

export const listVisaFeesController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const data = await adminPriceConfigService.listVisaFees(isActive);
    res.json({ data });
  }
);

export const createVisaFeeController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(visaFeeSchema, req.body);
    const data = await adminPriceConfigService.createVisaFee(input);
    res.status(201).json({ data });
  }
);

export const updateVisaFeeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updateVisaFeeSchema, req.body);
    const data = await adminPriceConfigService.updateVisaFee(id, input);
    if (!data) throw notFound("Visa fee not found");
    res.json({ data });
  }
);

export const deleteVisaFeeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deleteVisaFee(id);
    if (!success) throw notFound("Visa fee not found");
    res.json({ success: true });
  }
);

export const listOptionalActivitiesController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const destination = parseQueryString(req.query.destination);
    const data = await adminPriceConfigService.listOptionalActivities(isActive, destination);
    res.json({ data });
  }
);

export const createOptionalActivityController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(optionalActivitySchema, req.body);
    const data = await adminPriceConfigService.createOptionalActivity(input);
    res.status(201).json({ data });
  }
);

export const updateOptionalActivityController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updateOptionalActivitySchema, req.body);
    const data = await adminPriceConfigService.updateOptionalActivity(id, input);
    if (!data) throw notFound("Activity not found");
    res.json({ data });
  }
);

export const deleteOptionalActivityController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deleteOptionalActivity(id);
    if (!success) throw notFound("Activity not found");
    res.json({ success: true });
  }
);

export const listSeasonalPricingController = asyncHandler(
  async (req: Request, res: Response) => {
    const isActiveStr = parseQueryString(req.query.is_active);
    const isActive = isActiveStr === "true" 
      ? true 
      : isActiveStr === "false" 
        ? false 
        : undefined;
    const destination = parseQueryString(req.query.destination);
    const data = await adminPriceConfigService.listSeasonalPricing(isActive, destination);
    res.json({ data });
  }
);

export const createSeasonalPricingController = asyncHandler(
  async (req: Request, res: Response) => {
    const input = parseBody(seasonalPricingSchema, req.body);
    const data = await adminPriceConfigService.createSeasonalPricing(input);
    res.status(201).json({ data });
  }
);

export const updateSeasonalPricingController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const input = parseBody(updateSeasonalPricingSchema, req.body);
    const data = await adminPriceConfigService.updateSeasonalPricing(id, input);
    if (!data) throw notFound("Seasonal pricing not found");
    res.json({ data });
  }
);

export const deleteSeasonalPricingController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    const success = await adminPriceConfigService.deleteSeasonalPricing(id);
    if (!success) throw notFound("Seasonal pricing not found");
    res.json({ success: true });
  }
);