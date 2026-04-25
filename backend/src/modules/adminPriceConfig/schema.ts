import { z } from "zod";

export const destinationSchema = z.object({
  name: z.string().min(1).max(100),
  name_en: z.string().max(100).optional(),
  country: z.string().max(50).optional(),
  country_code: z.string().max(10).optional(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
});

export const updateDestinationSchema = destinationSchema.partial();

export const priceConfigSchema = z.object({
  destination: z.string().min(1).max(100),
  flight_price_per_person: z.number().int().min(0).default(0),
  hotel_3star_price_per_night: z.number().int().min(0).default(0),
  hotel_4star_price_per_night: z.number().int().min(0).default(0),
  hotel_5star_price_per_night: z.number().int().min(0).default(0),
  guide_price_per_day: z.number().int().min(0).default(0),
  insurance_price_per_person: z.number().int().min(0).default(0),
  transport_price_per_day: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const updatePriceConfigSchema = priceConfigSchema.partial();

export const carTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price_per_day: z.number().int().min(0).default(0),
  capacity: z.number().int().min(1).default(5),
  is_active: z.boolean().default(true),
});

export const updateCarTypeSchema = carTypeSchema.partial();

export const flightClassSchema = z.object({
  name: z.string().min(1).max(50),
  name_en: z.string().max(50).optional(),
  multiplier: z.number().positive(),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
});

export const updateFlightClassSchema = flightClassSchema.partial();

export const visaFeeSchema = z.object({
  destination: z.string().min(1).max(100),
  country: z.string().max(50).optional(),
  country_code: z.string().max(10).optional(),
  price_mnt: z.number().int().min(0).default(0),
  requirements: z.string().optional(),
  processing_time: z.string().max(100).optional(),
  is_active: z.boolean().default(true),
});

export const updateVisaFeeSchema = visaFeeSchema.partial();

export const optionalActivitySchema = z.object({
  name: z.string().min(1).max(100),
  name_en: z.string().max(100).optional(),
  description: z.string().optional(),
  price_model: z.enum(["per_day", "per_person", "fixed"]),
  price_value: z.number().int().min(0).default(0),
  destination: z.string().max(100).optional(),
  is_active: z.boolean().default(true),
  display_order: z.number().int().min(0).default(0),
});

export const updateOptionalActivitySchema = optionalActivitySchema.partial();

export const seasonalPricingSchema = z.object({
  destination: z.string().min(1).max(100),
  start_date: z.string(),
  end_date: z.string(),
  multiplier: z.number().min(0.5).max(3).default(1),
  is_active: z.boolean().default(true),
});

export const updateSeasonalPricingSchema = seasonalPricingSchema.partial();

export type DestinationInput = z.infer<typeof destinationSchema>;
export type PriceConfigInput = z.infer<typeof priceConfigSchema>;
export type CarTypeInput = z.infer<typeof carTypeSchema>;
export type FlightClassInput = z.infer<typeof flightClassSchema>;
export type VisaFeeInput = z.infer<typeof visaFeeSchema>;
export type OptionalActivityInput = z.infer<typeof optionalActivitySchema>;
export type SeasonalPricingInput = z.infer<typeof seasonalPricingSchema>;