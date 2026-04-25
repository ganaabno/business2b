import { db } from "../../db/client.js";
import { logger } from "../../shared/logger.js";

interface QuoteViewEvent {
  quote_id: string;
  visitor_id?: string;
  referrer?: string;
}

export const quoteAnalyticsService = {
  async trackView(quoteId: string, visitorId?: string, referrer?: string) {
    try {
      await db.query(
        `INSERT INTO quote_analytics (quote_id, visitor_id, event_type, event_data, created_at)
         VALUES ($1, $2, 'view', $3, NOW())`,
        [quoteId, visitorId, JSON.stringify({ referrer })]
      );
      logger.debug("Quote view tracked", { quoteId });
    } catch (error) {
      logger.error("trackView error", error);
    }
  },

  async trackConversion(quoteId: string, bookingId: string) {
    try {
      await db.query(
        `INSERT INTO quote_analytics (quote_id, visitor_id, event_type, event_data, created_at)
         VALUES ($1, NULL, 'convert', $2, NOW())`,
        [quoteId, JSON.stringify({ booking_id: bookingId })]
      );
      logger.debug("Quote conversion tracked", { quoteId, bookingId });
    } catch (error) {
      logger.error("trackConversion error", error);
    }
  },

  async getQuoteStats(quoteId: string) {
    try {
      const result = await db.query(`
        SELECT event_type, COUNT(*) as count 
        FROM quote_analytics 
        WHERE quote_id = $1 
        GROUP BY event_type
      `, [quoteId]);
      
      const stats = { views: 0, conversions: 0, shares: 0, expires: 0 };
      for (const row of result.rows) {
        switch (row.event_type) {
          case 'view': stats.views = Number(row.count); break;
          case 'convert': stats.conversions = Number(row.count); break;
          case 'share': stats.shares = Number(row.count); break;
          case 'expire': stats.expires = Number(row.count); break;
        }
      }
      return stats;
    } catch (error) {
      logger.error("getQuoteStats error", error);
      return { views: 0, conversions: 0, shares: 0, expires: 0 };
    }
  },

  async getPopularDestinations(days: number = 30) {
    try {
      const result = await db.query(`
        SELECT destination, COUNT(*) as count 
        FROM price_quotes 
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY destination 
        ORDER BY count DESC 
        LIMIT 10
      `);
      return result.rows;
    } catch (error) {
      logger.error("getPopularDestinations error", error);
      return [];
    }
  },

  async getConversionRate(days: number = 30) {
    try {
      const total = await db.query(`
        SELECT COUNT(*) as count FROM price_quotes 
        WHERE created_at > NOW() - INTERVAL '${days} days'
      `);
      
      const converted = await db.query(`
        SELECT COUNT(*) as count FROM price_quotes 
        WHERE status = 'converted' 
        AND created_at > NOW() - INTERVAL '${days} days'
      `);

      const totalCount = Number(total.rows[0]?.count || 0);
      const convertedCount = Number(converted.rows[0]?.count || 0);
      
      return {
        total: totalCount,
        converted: convertedCount,
        rate: totalCount > 0 ? (convertedCount / totalCount) * 100 : 0,
      };
    } catch (error) {
      logger.error("getConversionRate error", error);
      return { total: 0, converted: 0, rate: 0 };
    }
  },

  async getRevenueStats(days: number = 30) {
    try {
      const result = await db.query(`
        SELECT SUM(total_price) as revenue, COUNT(*) as count 
        FROM price_quotes 
        WHERE status = 'converted' 
        AND created_at > NOW() - INTERVAL '${days} days'
      `);
      
      return {
        revenue: Number(result.rows[0]?.revenue || 0),
        count: Number(result.rows[0]?.count || 0),
      };
    } catch (error) {
      logger.error("getRevenueStats error", error);
      return { revenue: 0, count: 0 };
    }
  },
};