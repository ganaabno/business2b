import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env.js";
import { logger } from "../../shared/logger.js";
import { db } from "../../db/client.js";

export interface BookingDetails {
  destination?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  people?: number;
  hotelType?: "3star" | "4star" | "5star";
  flightClass?: "economy" | "business" | "first";
  activities?: string[];
  carType?: string;
}

export interface TourForAI {
  id: string;
  title: string;
  destination: string;
  base_price: number;
  departure_date: string;
  duration_day: number;
  seats: number;
  tour_type?: string;
  image_key?: string;
}

const TOUR_FIELDS = `id, title, destination, base_price, departure_date, duration_day, seats, tour_type, image_key`;

async function getToursFromDB(limit = 20): Promise<TourForAI[]> {
  try {
    const result = await db.query(`
      SELECT ${TOUR_FIELDS}
      FROM tours
      WHERE status = 'active' AND seats > 0
      ORDER BY base_price ASC NULLS LAST
      LIMIT $1
    `, [limit]);
    return result.rows as TourForAI[];
  } catch (error) {
    logger.error("getToursFromDB error", error);
    return [];
  }
}

async function searchToursByPriceDB(maxPrice: number, limit = 10): Promise<TourForAI[]> {
  try {
    const result = await db.query(`
      SELECT ${TOUR_FIELDS}
      FROM tours
      WHERE status = 'active' AND seats > 0 AND base_price <= $1
      ORDER BY base_price ASC
      LIMIT $2
    `, [maxPrice, limit]);
    return result.rows as TourForAI[];
  } catch (error) {
    logger.error("searchToursByPriceDB error", error);
    return [];
  }
}

async function searchToursByDestinationDB(destination: string, limit = 10): Promise<TourForAI[]> {
  try {
    const result = await db.query(`
      SELECT ${TOUR_FIELDS}
      FROM tours
      WHERE status = 'active' AND seats > 0 
        AND (destination ILIKE $1 OR title ILIKE $1)
      ORDER BY base_price ASC
      LIMIT $2
    `, [`%${destination}%`, limit]);
    return result.rows as TourForAI[];
  } catch (error) {
    logger.error("searchToursByDestinationDB error", error);
    return [];
  }
}

const CHAT_SYSTEM_PROMPT = `Та нь аялалын зөвлөх туслах "GTrip" систем дээр ажилладаг.

Таны үүрэг:
1. Хэрэглэгчид аялалын талаар асуухад зөвлөгөө өгөх
2. Аялын үнэ тооцоо хийхэд туслах
3. Дараах мэдээллийг цуглуулах:
   - Зорилго (улас/хот)
   - Огноо (эхлэх, дуусах)
   - Хүний тоо
   - Зочид буудлын түвшин (3★, 4★, 5★)
   - Нислэгийн ангилал (economy, business, first)
   - Чөлөөт үйлчилгээ (гид, хоол, тээвэр, г.м)

Таны хариу:
- Монгол хэл дээр
- Товч, тодорхой
- Эерэг, мэндчилгээтэй
- Хэрэв мэдээлэл дутуу бол дараах асуултуудыг асуух

Түүх:
- Солонгос, Япон, Хятад, Тайланд, Вьетнам, Монгол, Турк, АНЭ-р гэх мэт алдартай чиглэлүүд
- Сезон: Зун (6-8 сар) - үнэ өндөр, Өвөл (12-2 сар) - хямдарч болох
- Хүний тоо ихэвэл группdiscount байж болно

АЯЛЫН МЭДЭЭЛЛЭЛ:
- Миний өмнөөөө энэ системд идэвхтэй аялууд байгаа. Би тэдгээрийг цаг алдалгүй авах боломжтой.
- Аял бүрт: title ( нэр), destination ( газар), base_price ( үнэ), departure_date ( огноо), duration_day ( хоног), seats ( суудал тоо) бий.
- Хамгийн бага үнэтэй аялыг олохын тулд getCheapestTours() эсвэл getAllTours() функцийг АШИГЛААРАЙ.

Тооцоо талаар:
- flight: Эдийн засаг (1x), Бизнес (2.5x), Фирст (4x)
- Зочид: 3★ (150,000₮), 4★ (250,000₮), 5★ (400,000₮) ойнөрөө
- Гид: 100,000₮/өдөр
- Тээвэр: 80,000₮/өдөр
- Даатгал: 50,000₮/хүн

Хариулах үед:
- Аялын үнэ, огноо, хугацаа, суудал тоог заавал бич
- Markdown хэлбэрээр (list, bold) ашиглан сайтар бүтүүлээрэй
- Хэрэглэгчид сонгох боломж өгөө`;

export class GeminiClient {
  private genAI: GoogleGenerativeAI | null = null;
  private isConfigured = false;
  private toursCache: { data: TourForAI[]; timestamp: number } | null = null;
  private CACHE_TTL = 5 * 60 * 1000;

  constructor() {
    if (env.geminiApiKey) {
      try {
        this.genAI = new GoogleGenerativeAI(env.geminiApiKey);
        this.isConfigured = true;
        logger.info("Gemini client initialized", { model: env.geminiModel });
      } catch (error) {
        logger.warn("Failed to initialize Gemini client", error);
      }
    } else {
      logger.warn("GEMINI_AI_API_KEY not configured");
    }
  }

  isEnabled(): boolean {
    return this.isConfigured && this.genAI !== null;
  }

  async getToursForAI(limit = 20): Promise<TourForAI[]> {
    if (this.toursCache && Date.now() - this.toursCache.timestamp < this.CACHE_TTL) {
      return this.toursCache.data;
    }
    const tours = await getToursFromDB(limit);
    this.toursCache = { data: tours, timestamp: Date.now() };
    return tours;
  }

  async getCheapestToursForAI(count = 5, maxPrice?: number): Promise<TourForAI[]> {
    if (maxPrice) return searchToursByPriceDB(maxPrice, count);
    return getToursFromDB(count);
  }

  async searchToursByDestinationForAI(destination: string, limit = 10): Promise<TourForAI[]> {
    return searchToursByDestinationDB(destination, limit);
  }

  private formatToursForAI(tours: TourForAI[]): string {
    if (tours.length === 0) return "Идэвхтэй аял олдсонгүй.";
    const lines = [`**Идэвхтэй аялууд (${tours.length}):**\n`];
    for (const tour of tours) {
      const priceStr = (tour.base_price || 0).toLocaleString("mn-MN");
      const dateStr = tour.departure_date ? new Date(tour.departure_date).toLocaleDateString("mn-MN") : "Тодорхойгүй";
      lines.push(`**${tour.title}**`);
      lines.push(`- 📍 ${tour.destination}`);
      lines.push(`- 💰 ${priceStr}₮`);
      lines.push(`- 📅 ${dateStr} (${tour.duration_day} хоног)`);
      lines.push(`- 💺 ${tour.seats} суудал`);
      lines.push("");
    }
    return lines.join("\n");
  }

  async generateResponse(
    userMessage: string,
    context?: { conversationHistory?: string[]; userPreferences?: Record<string, unknown> }
  ): Promise<string> {
    if (!this.isEnabled() || !this.genAI) {
      return "Уучлаарай, AI тусгай ажиллахгүй байна. Та админтай холбоо барина уу.";
    }
    try {
      const tours = await this.getToursForAI(20);
      const toursContext = this.formatToursForAI(tours);
      const enhancedSystemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n---ХОЙВОЛТ ЗАСАЛ---\n${toursContext}\n---ТӨГСӨЛ---\n\nЭдгээрийг ашиглан хэрэглэгчид тусална уу. Үнэ харьцуулахдаа бодит base_price-аар тооцоо.`;

      const model = this.genAI.getGenerativeModel({ 
        model: env.geminiModel,
        generationConfig: { maxOutputTokens: env.geminiMaxTokens, temperature: env.geminiTemperature },
      });

      const history: { role: "user" | "model"; parts: { text: string }[] }[] = [
        { role: "user", parts: [{ text: enhancedSystemPrompt }] },
        { role: "model", parts: [{ text: "Сайн байна уу! Би танд аялалын зөвлөхөнд тусална. Ямар улс/хотруу явахыг хүсэж байна вэ?" }] },
      ];

      if (context?.conversationHistory) {
        for (const msg of context.conversationHistory.slice(-10)) {
          const role = msg.startsWith("Bot:") ? "model" : "user";
          history.push({ role, parts: [{ text: msg }] });
        }
      }

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      return result.response.text() || "Уучлаарай, хариу гаргаж чадсангүй.";
    } catch (error) {
      logger.error("Gemini generateResponse error", error);
      return "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.";
    }
  }

  async extractBookingDetails(userMessage: string): Promise<BookingDetails> {
    if (!this.isEnabled() || !this.genAI) return {};
    const extractionPrompt = `Энэ мессежээс дараах мэдээллийг JSON форматаар гаргаж өгөөх. Зөвхөн JSON л гаргаг, өөр юм бичихгүй:

{
  "destination": "улас/хот нэр",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "days": тоо,
  "people": тоо,
  "hotelType": "3star|4star|5star",
  "flightClass": "economy|business|first",
  "activities": ["гид", "хоол", "тээвэр"],
  "carType": "машин нэр"
}

Мессеж: ${userMessage}`;
    try {
      const model = this.genAI.getGenerativeModel({ model: env.geminiModel, generationConfig: { maxOutputTokens: 512, temperature: 0.1 } });
      const result = await model.generateContent(extractionPrompt);
      const response = result.response.text();
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          destination: parsed.destination,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          days: Number(parsed.days) || undefined,
          people: Number(parsed.people) || undefined,
          hotelType: parsed.hotelType,
          flightClass: parsed.flightClass,
          activities: parsed.activities,
          carType: parsed.carType,
        };
      }
    } catch (error) { logger.warn("extractBookingDetails parsing failed", error); }
    return {};
  }

  async generateFollowUp(currentDetails: BookingDetails, missingFields: string[]): Promise<string> {
    const suggestions: string[] = [];
    if (missingFields.includes("destination")) suggestions.push("Ямар улс/хотруу явах вэ?");
    if (missingFields.includes("dates")) suggestions.push("Хэдийд явах вэ?");
    if (missingFields.includes("people")) suggestions.push("Хэдэн хүн явах вэ?");
    if (missingFields.includes("hotelType")) suggestions.push("Ямар зочид буудал сонгох вэ? (3★, 4★, 5★)");
    if (missingFields.includes("flightClass")) suggestions.push("Ямар нислэг сонгох вэ? (economy, business, first)");
    return suggestions.join(" ") || "Та өөр асуух зүйл байна уу?";
  }

  async generateQuoteSummary(details: BookingDetails, totalPrice: number): Promise<string> {
    const breakdown: string[] = [];
    breakdown.push(`📍 ${details.destination || "Зорилго тодорхойгүй"}`);
    if (details.startDate && details.endDate) breakdown.push(`📅 ${details.startDate} - ${details.endDate}`);
    if (details.people) breakdown.push(`👥 ${details.people} хүн`);
    if (details.hotelType) { const stars = { "3star": "3★", "4star": "4★", "5star": "5★" }; breakdown.push(`🏨 Зочид буудал: ${stars[details.hotelType]}`); }
    if (details.flightClass) breakdown.push(`✈️ Нислэг: ${details.flightClass}`);
    if (details.activities?.length) breakdown.push(`📋 ${details.activities.join(", ")}`);
    breakdown.push(`\n💰 Нийт: ${totalPrice.toLocaleString("mn-MN")}₮`);
    return breakdown.join("\n");
  }

  async generateGreeting(userPreferences?: Record<string, unknown>): Promise<string> {
    const tours = await this.getToursForAI(5);
    const cheapestTour = tours[0];
    const priceStr = cheapestTour ? (cheapestTour.base_price || 0).toLocaleString("mn-MN") + "₮" : "";
    const greetings = [
      "Сайн байна уу! Би танд аялалын зөвлөхөнд тусална. " + (cheapestTour ? "Одоогоор хамгийн хямд аял бол " + cheapestTour.title + " - " + priceStr + " байна." : ""),
      "Сайн байна уу! Ямар аялал хүсэж байна вэ? " + (cheapestTour ? "Хамгийн хямд вариант: " + cheapestTour.title : ""),
    ];
    if (userPreferences?.lastDestination) return "Сайн байна уу! " + userPreferences.lastDestination + " руу дахин явахыг хүсэж байна уу?";
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

export const geminiClient = new GeminiClient();