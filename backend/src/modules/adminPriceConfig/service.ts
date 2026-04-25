import { db } from "../../db/client.js";
import { logger } from "../../shared/logger.js";
import type {
  DestinationInput,
  PriceConfigInput,
  CarTypeInput,
  FlightClassInput,
  VisaFeeInput,
  OptionalActivityInput,
  SeasonalPricingInput,
} from "./schema.js";

async function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(sql, params);
  return result.rows as T[];
}

async function queryRow<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] || null;
}

export const adminPriceConfigService = {
  async listDestinations(isActive?: boolean) {
    try {
      let sql = 'SELECT * FROM destinations ORDER BY display_order';
      const params: unknown[] = [];
      if (isActive !== undefined) {
        sql = 'SELECT * FROM destinations WHERE is_active = $1 ORDER BY display_order';
        params.push(isActive);
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listDestinations error", error);
      return [];
    }
  },

  async getDestination(id: string) {
    try {
      return queryRow('SELECT * FROM destinations WHERE id = $1', [id]);
    } catch (error) {
      logger.error("getDestination error", error);
      return null;
    }
  },

  async createDestination(data: DestinationInput) {
    try {
      const sql = `
        INSERT INTO destinations (name, name_en, country, country_code, is_active, display_order, description, image_url, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`;
      const params = [
        data.name,
        data.name_en || null,
        data.country || null,
        data.country_code || null,
        data.is_active ?? true,
        data.display_order ?? 0,
        data.description || null,
        data.image_url || null,
      ];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createDestination error", error);
      throw error;
    }
  },

  async updateDestination(id: string, data: Partial<DestinationInput>) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        paramIndex++;
        sets.push(`name = $${paramIndex}`);
        params.push(data.name);
      }
      if (data.name_en !== undefined) {
        paramIndex++;
        sets.push(`name_en = $${paramIndex}`);
        params.push(data.name_en);
      }
      if (data.country !== undefined) {
        paramIndex++;
        sets.push(`country = $${paramIndex}`);
        params.push(data.country);
      }
      if (data.country_code !== undefined) {
        paramIndex++;
        sets.push(`country_code = $${paramIndex}`);
        params.push(data.country_code);
      }
      if (data.is_active !== undefined) {
        paramIndex++;
        sets.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
      }
      if (data.display_order !== undefined) {
        paramIndex++;
        sets.push(`display_order = $${paramIndex}`);
        params.push(data.display_order);
      }
      if (data.description !== undefined) {
        paramIndex++;
        sets.push(`description = $${paramIndex}`);
        params.push(data.description);
      }
      if (data.image_url !== undefined) {
        paramIndex++;
        sets.push(`image_url = $${paramIndex}`);
        params.push(data.image_url);
      }

      params.push(id);
      const sql = `UPDATE destinations SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updateDestination error", error);
      throw error;
    }
  },

  async deleteDestination(id: string) {
    try {
      await db.query('DELETE FROM destinations WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deleteDestination error", error);
      return false;
    }
  },

  async listPriceConfigs(isActive?: boolean) {
    try {
      let sql = 'SELECT * FROM travel_price_config ORDER BY destination';
      const params: unknown[] = [];
      if (isActive !== undefined) {
        sql = 'SELECT * FROM travel_price_config WHERE is_active = $1 ORDER BY destination';
        params.push(isActive);
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listPriceConfigs error", error);
      return [];
    }
  },

  async createPriceConfig(data: PriceConfigInput) {
    try {
      const sql = `
        INSERT INTO travel_price_config (destination, flight_price_per_person, hotel_3star_price_per_night, hotel_4star_price_per_night, hotel_5star_price_per_night, guide_price_per_day, insurance_price_per_person, transport_price_per_day, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *`;
      const params = [
        data.destination,
        data.flight_price_per_person,
        data.hotel_3star_price_per_night,
        data.hotel_4star_price_per_night,
        data.hotel_5star_price_per_night,
        data.guide_price_per_day,
        data.insurance_price_per_person,
        data.transport_price_per_day,
        data.is_active ?? true,
      ];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createPriceConfig error", error);
      throw error;
    }
  },

  async updatePriceConfig(id: string, data: Partial<PriceConfigInput>) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIndex = 1;

      const fieldMap: Record<string, string> = {
        destination: "destination",
        flight_price_per_person: "flight_price_per_person",
        hotel_3star_price_per_night: "hotel_3star_price_per_night",
        hotel_4star_price_per_night: "hotel_4star_price_per_night",
        hotel_5star_price_per_night: "hotel_5star_price_per_night",
        guide_price_per_day: "guide_price_per_day",
        insurance_price_per_person: "insurance_price_per_person",
        transport_price_per_day: "transport_price_per_day",
        is_active: "is_active",
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if ((data as Record<string, unknown>)[key] !== undefined) {
          paramIndex++;
          sets.push(`${col} = $${paramIndex}`);
          params.push((data as Record<string, unknown>)[key]);
        }
      }

      params.push(id);
      const sql = `UPDATE travel_price_config SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updatePriceConfig error", error);
      throw error;
    }
  },

  async deletePriceConfig(id: string) {
    try {
      await db.query('DELETE FROM travel_price_config WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deletePriceConfig error", error);
      return false;
    }
  },

  async listCarTypes(isActive?: boolean) {
    try {
      let sql = 'SELECT * FROM car_types ORDER BY name';
      const params: unknown[] = [];
      if (isActive !== undefined) {
        sql = 'SELECT * FROM car_types WHERE is_active = $1 ORDER BY name';
        params.push(isActive);
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listCarTypes error", error);
      return [];
    }
  },

  async createCarType(data: CarTypeInput) {
    try {
      const sql = `
        INSERT INTO car_types (name, description, price_per_day, capacity, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING *`;
      const params = [data.name, data.description || null, data.price_per_day, data.capacity, data.is_active ?? true];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createCarType error", error);
      throw error;
    }
  },

  async updateCarType(id: string, data: Partial<CarTypeInput>) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        paramIndex++;
        sets.push(`name = $${paramIndex}`);
        params.push(data.name);
      }
      if (data.description !== undefined) {
        paramIndex++;
        sets.push(`description = $${paramIndex}`);
        params.push(data.description);
      }
      if (data.price_per_day !== undefined) {
        paramIndex++;
        sets.push(`price_per_day = $${paramIndex}`);
        params.push(data.price_per_day);
      }
      if (data.capacity !== undefined) {
        paramIndex++;
        sets.push(`capacity = $${paramIndex}`);
        params.push(data.capacity);
      }
      if (data.is_active !== undefined) {
        paramIndex++;
        sets.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
      }

      params.push(id);
      const sql = `UPDATE car_types SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updateCarType error", error);
      throw error;
    }
  },

  async deleteCarType(id: string) {
    try {
      await db.query('DELETE FROM car_types WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deleteCarType error", error);
      return false;
    }
  },

  async listFlightClasses(isActive?: boolean) {
    try {
      let sql = 'SELECT * FROM flight_classes ORDER BY display_order';
      const params: unknown[] = [];
      if (isActive !== undefined) {
        sql = 'SELECT * FROM flight_classes WHERE is_active = $1 ORDER BY display_order';
        params.push(isActive);
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listFlightClasses error", error);
      return [];
    }
  },

  async createFlightClass(data: FlightClassInput) {
    try {
      const sql = `
        INSERT INTO flight_classes (name, name_en, multiplier, description, is_active, display_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *`;
      const params = [
        data.name,
        data.name_en || null,
        data.multiplier,
        data.description || null,
        data.is_active ?? true,
        data.display_order ?? 0,
      ];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createFlightClass error", error);
      throw error;
    }
  },

  async updateFlightClass(id: string, data: Partial<FlightClassInput>) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        paramIndex++;
        sets.push(`name = $${paramIndex}`);
        params.push(data.name);
      }
      if (data.name_en !== undefined) {
        paramIndex++;
        sets.push(`name_en = $${paramIndex}`);
        params.push(data.name_en);
      }
      if (data.multiplier !== undefined) {
        paramIndex++;
        sets.push(`multiplier = $${paramIndex}`);
        params.push(data.multiplier);
      }
      if (data.description !== undefined) {
        paramIndex++;
        sets.push(`description = $${paramIndex}`);
        params.push(data.description);
      }
      if (data.is_active !== undefined) {
        paramIndex++;
        sets.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
      }
      if (data.display_order !== undefined) {
        paramIndex++;
        sets.push(`display_order = $${paramIndex}`);
        params.push(data.display_order);
      }

      params.push(id);
      const sql = `UPDATE flight_classes SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updateFlightClass error", error);
      throw error;
    }
  },

  async deleteFlightClass(id: string) {
    try {
      await db.query('DELETE FROM flight_classes WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deleteFlightClass error", error);
      return false;
    }
  },

  async listVisaFees(isActive?: boolean) {
    try {
      let sql = 'SELECT * FROM visa_fees ORDER BY destination';
      const params: unknown[] = [];
      if (isActive !== undefined) {
        sql = 'SELECT * FROM visa_fees WHERE is_active = $1 ORDER BY destination';
        params.push(isActive);
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listVisaFees error", error);
      return [];
    }
  },

  async createVisaFee(data: VisaFeeInput) {
    try {
      const sql = `
        INSERT INTO visa_fees (destination, country, country_code, price_mnt, requirements, processing_time, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING *`;
      const params = [
        data.destination,
        data.country || null,
        data.country_code || null,
        data.price_mnt,
        data.requirements || null,
        data.processing_time || null,
        data.is_active ?? true,
      ];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createVisaFee error", error);
      throw error;
    }
  },

  async updateVisaFee(id: string, data: Partial<VisaFeeInput>) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.destination !== undefined) {
        paramIndex++;
        sets.push(`destination = $${paramIndex}`);
        params.push(data.destination);
      }
      if (data.country !== undefined) {
        paramIndex++;
        sets.push(`country = $${paramIndex}`);
        params.push(data.country);
      }
      if (data.country_code !== undefined) {
        paramIndex++;
        sets.push(`country_code = $${paramIndex}`);
        params.push(data.country_code);
      }
      if (data.price_mnt !== undefined) {
        paramIndex++;
        sets.push(`price_mnt = $${paramIndex}`);
        params.push(data.price_mnt);
      }
      if (data.requirements !== undefined) {
        paramIndex++;
        sets.push(`requirements = $${paramIndex}`);
        params.push(data.requirements);
      }
      if (data.processing_time !== undefined) {
        paramIndex++;
        sets.push(`processing_time = $${paramIndex}`);
        params.push(data.processing_time);
      }
      if (data.is_active !== undefined) {
        paramIndex++;
        sets.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
      }

      params.push(id);
      const sql = `UPDATE visa_fees SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updateVisaFee error", error);
      throw error;
    }
  },

  async deleteVisaFee(id: string) {
    try {
      await db.query('DELETE FROM visa_fees WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deleteVisaFee error", error);
      return false;
    }
  },

  async listOptionalActivities(isActive?: boolean, destination?: string) {
    try {
      let sql = 'SELECT * FROM optional_activities ORDER BY display_order';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (isActive !== undefined) {
        conditions.push(`is_active = $${conditions.length + 1}`);
        params.push(isActive);
      }
      if (destination) {
        conditions.push(`destination = $${conditions.length + 1}`);
        params.push(destination);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listOptionalActivities error", error);
      return [];
    }
  },

  async createOptionalActivity(data: OptionalActivityInput) {
    try {
      const sql = `
        INSERT INTO optional_activities (name, name_en, description, price_model, price_value, destination, is_active, display_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING *`;
      const params = [
        data.name,
        data.name_en || null,
        data.description || null,
        data.price_model,
        data.price_value,
        data.destination || null,
        data.is_active ?? true,
        data.display_order ?? 0,
      ];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createOptionalActivity error", error);
      throw error;
    }
  },

  async updateOptionalActivity(id: string, data: Partial<OptionalActivityInput>) {
    try {
      const sets: string[] = ["updated_at = NOW()"];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.name !== undefined) {
        paramIndex++;
        sets.push(`name = $${paramIndex}`);
        params.push(data.name);
      }
      if (data.name_en !== undefined) {
        paramIndex++;
        sets.push(`name_en = $${paramIndex}`);
        params.push(data.name_en);
      }
      if (data.description !== undefined) {
        paramIndex++;
        sets.push(`description = $${paramIndex}`);
        params.push(data.description);
      }
      if (data.price_model !== undefined) {
        paramIndex++;
        sets.push(`price_model = $${paramIndex}`);
        params.push(data.price_model);
      }
      if (data.price_value !== undefined) {
        paramIndex++;
        sets.push(`price_value = $${paramIndex}`);
        params.push(data.price_value);
      }
      if (data.destination !== undefined) {
        paramIndex++;
        sets.push(`destination = $${paramIndex}`);
        params.push(data.destination);
      }
      if (data.is_active !== undefined) {
        paramIndex++;
        sets.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
      }
      if (data.display_order !== undefined) {
        paramIndex++;
        sets.push(`display_order = $${paramIndex}`);
        params.push(data.display_order);
      }

      params.push(id);
      const sql = `UPDATE optional_activities SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updateOptionalActivity error", error);
      throw error;
    }
  },

  async deleteOptionalActivity(id: string) {
    try {
      await db.query('DELETE FROM optional_activities WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deleteOptionalActivity error", error);
      return false;
    }
  },

  async listSeasonalPricing(isActive?: boolean, destination?: string) {
    try {
      let sql = 'SELECT * FROM seasonal_pricing ORDER BY start_date';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (isActive !== undefined) {
        conditions.push(`is_active = $${conditions.length + 1}`);
        params.push(isActive);
      }
      if (destination) {
        conditions.push(`destination = $${conditions.length + 1}`);
        params.push(destination);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      return queryRows(sql, params);
    } catch (error) {
      logger.error("listSeasonalPricing error", error);
      return [];
    }
  },

  async createSeasonalPricing(data: SeasonalPricingInput) {
    try {
      const sql = `
        INSERT INTO seasonal_pricing (destination, start_date, end_date, multiplier, is_active, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`;
      const params = [
        data.destination,
        data.start_date,
        data.end_date,
        data.multiplier,
        data.is_active ?? true,
      ];
      return queryRow(sql, params);
    } catch (error) {
      logger.error("createSeasonalPricing error", error);
      throw error;
    }
  },

  async updateSeasonalPricing(id: string, data: Partial<SeasonalPricingInput>) {
    try {
      const sets: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (data.destination !== undefined) {
        paramIndex++;
        sets.push(`destination = $${paramIndex}`);
        params.push(data.destination);
      }
      if (data.start_date !== undefined) {
        paramIndex++;
        sets.push(`start_date = $${paramIndex}`);
        params.push(data.start_date);
      }
      if (data.end_date !== undefined) {
        paramIndex++;
        sets.push(`end_date = $${paramIndex}`);
        params.push(data.end_date);
      }
      if (data.multiplier !== undefined) {
        paramIndex++;
        sets.push(`multiplier = $${paramIndex}`);
        params.push(data.multiplier);
      }
      if (data.is_active !== undefined) {
        paramIndex++;
        sets.push(`is_active = $${paramIndex}`);
        params.push(data.is_active);
      }

      if (sets.length === 0) {
        return queryRow('SELECT * FROM seasonal_pricing WHERE id = $1', [id]);
      }

      params.push(id);
      const sql = `UPDATE seasonal_pricing SET ${sets.join(", ")} WHERE id = $${paramIndex} RETURNING *`;
      return queryRow(sql, params);
    } catch (error) {
      logger.error("updateSeasonalPricing error", error);
      throw error;
    }
  },

  async deleteSeasonalPricing(id: string) {
    try {
      await db.query('DELETE FROM seasonal_pricing WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error("deleteSeasonalPricing error", error);
      return false;
    }
  },
};