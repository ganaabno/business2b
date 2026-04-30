/**
 * Groq AI Client for Chatbot
 *
 * This module provides a clean, production-ready integration with Groq API
 * for generating AI responses in the travel chatbot.
 */

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
  name?: string;
  description?: string;
  base_price: number;
  departure_date?: string;
  departuredate?: string;
  duration_day?: number;
  seats: number;
  available_seats?: number;
  status?: string;
  tour_type?: string;
  image_key?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const TOUR_FIELDS = `id, title, name, description, departure_date, departuredate, base_price, seats, available_seats, status, tour_type, duration_day, image_key`;

// Database functions (kept from original implementation)
async function getToursFromDB(limit = 20): Promise<TourForAI[]> {
  try {
    const result = await db.query(
      `
      SELECT ${TOUR_FIELDS}
      FROM tours
      WHERE status = 'active' AND seats > 0
      ORDER BY base_price ASC NULLS LAST
      LIMIT $1
    `,
      [limit],
    );
    return result.rows as TourForAI[];
  } catch (error) {
    logger.error("getToursFromDB error", error);
    return [];
  }
}

async function searchToursByPriceDB(
  maxPrice: number,
  limit = 10,
): Promise<TourForAI[]> {
  try {
    const result = await db.query(
      `
      SELECT ${TOUR_FIELDS}
      FROM tours
      WHERE status = 'active' AND seats > 0 AND base_price <= $1
      ORDER BY base_price ASC
      LIMIT $2
    `,
      [maxPrice, limit],
    );
    return result.rows as TourForAI[];
  } catch (error) {
    logger.error("searchToursByPriceDB error", error);
    return [];
  }
}

async function searchToursByDestinationDB(
  destination: string,
  limit = 10,
): Promise<TourForAI[]> {
  try {
    // Search in title and description instead of destination column
    const result = await db.query(
      `
      SELECT ${TOUR_FIELDS}
      FROM tours
      WHERE status = 'active' AND seats > 0
        AND (title ILIKE $1 OR name ILIKE $1 OR description ILIKE $1)
      ORDER BY base_price ASC
      LIMIT $2
    `,
      [`%${destination}%`, limit],
    );
    return result.rows as TourForAI[];
  } catch (error) {
    logger.error("searchToursByDestinationDB error", error);
    return [];
  }
}

// System prompts (kept from original implementation)
const CHAT_SYSTEM_PROMPT = `Та нь GTrip аялалын AI зөвлөх.

🎯 Таны зорилго:
- Хэрэглэгчид хамгийн тохирох аялалыг ОЛЖ ӨГӨХ
- Зүгээр хариулах биш → ШИЙДЭЛ санал болгох
- Хэрэглэгчийг шийдвэр гаргахад туслах

💡 Таны зан байдал:
- Найрсаг, мэргэжлийн
- Богино мөртлөө үнэ цэнэтэй
- Худал ярихгүй, бодит өгөгдөл ашиглах

🧠 СЭТГЭХ ДҮРЭМ:
- Хямд гэвэл → хамгийн бага үнэ
- Шилдэг гэвэл → үнэ/чанарын харьцаа
- Зөвлөх гэвэл → 2-3 сонголт + reason
- Хэрвээ мэдээлэл дутуу → асуулт асуу

📊 Та эдгээр өгөгдлийг ашиглана:
- title, name, base_price, duration_day, departure_date, departuredate, seats

🚫 ХОРИГЛОХ:
- Хоосон ерөнхий яриа
- "Мэдэхгүй" гэж шууд хэлэх
- Урт нуршсан текст

✅ ҮР ДҮН:
- Markdown ашигла
- Жагсаалт ашигла
- Үнэ + огноо заавал бич

Таны үүрэг:
1. Хэрэглэгчид аялалын талаар асуухад зөвлөгөө өгөх
2. Аялын үнэ тооцоо хийхэд туслах
3. Дараах мэдээллийг цуглуулах:
   - Зорилго (улс/хот)
   - Огноо (эхлэх, дуусах)
   - Хүний тоо
   - Зочид буудал (Phoenix, Hilton, гэх мэт)
   - Нислэгийн ангилал (economy, business, first)
   - Чөлөөт үйлчилгээ (хоол, тээвэр, г.м)

Таны хариу:
- Монгол хэл дээр
- Товч, тодорхой
- Эерэг, мэндчилгээтэй
- Хэрэв мэдээлэл дутуу бол дараах асуултуудыг асуух
- Хэрэглэгчид өөрийн бодолтой, байгалийн хэлээр хариулах`;

const RECOMMENDATION_SYSTEM_PROMPT = `Та нь GTrip аялалын зөвлөх AI. Хэрэглэгчээс аялалын талаар асуусан бөгөөд тэдгээрийн хүсэлтэд тохирсон аялуудыг санал болгох болно.

ЧУХАЛ ЗААВАР:
1. Хэрэглэгчийн асуусан аялын хүсэлтэнд тохирсон аялуудыг ДООРХ ЖАГСААЛТААС сонгоно уу
2. Хэрэглэгчид өөрийн үгээр, байгалийн хэлээр хариулах
3. Тус бүрийн давуу талыг товч тайлбарлах
4. Үнэ, огноо, хоног, суудал тоог заавал бичих
5. Markdown ашиглан сайтар бүтүүлээрэй

АЯЛУУДЫН ЖАГСААЛТ:
{AUTHORED_TOURS}

{INTENT_CONTEXT}

Хэрэглэгчийн асуусан аял: {USER_MESSAGE}

Хариулахдаа:
- Эхлээд хэрэглэгчийн хүсэлтийг тусгайлан тайлбарласнаа бич
- Сонгосон аялуудыг жагсааж, тус бүрийн онцлогийг бич
- "Сонгох" эсвэл "Захиалах" болон товч үнийг заавал бич
- 2-3 аялал санал болговол хүрэлцээтэй`;

const RECOMMENDATION_FALLBACK = `Хэрэглэгчийн хүсэлтэд нийцэх аялууд олдлоо:`;

/**
 * Groq Client Class
 */
export class GroqClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private isConfigured: boolean;
  private toursCache: { data: TourForAI[]; timestamp: number } | null = null;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.apiKey = env.groqApiKey || process.env.GROQ_API_KEY || "";
    this.baseUrl = "https://api.groq.com/openai/v1";
    this.model = env.groqModel || "llama3-70b-8192";
    this.isConfigured = !!this.apiKey;

    if (this.isConfigured) {
      logger.info("Groq client initialized", { model: this.model });
    } else {
      logger.warn("GROQ_API_KEY not configured");
    }
  }

  /**
   * Check if client is properly configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Generate AI response from messages
   */
  async generateAIResponse(messages: ChatMessage[]): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error("Groq API key not configured");
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1024,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error("Groq API error", error);
        throw new Error(`Groq API error: ${error.error?.message || "Unknown error"}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No content in Groq response");
      }

      return content;
    } catch (error) {
      logger.error("Groq generateAIResponse error", error);
      throw error;
    }
  }

  /**
   * Get tours for AI (with caching)
   */
  async getToursForAI(limit = 20): Promise<TourForAI[]> {
    if (
      this.toursCache &&
      Date.now() - this.toursCache.timestamp < this.CACHE_TTL
    ) {
      return this.toursCache.data;
    }
    const tours = await getToursFromDB(limit);
    this.toursCache = { data: tours, timestamp: Date.now() };
    return tours;
  }

  /**
   * Get cheapest tours
   */
  async getCheapestToursForAI(
    count = 5,
    maxPrice?: number,
  ): Promise<TourForAI[]> {
    if (maxPrice) return searchToursByPriceDB(maxPrice, count);
    return getToursFromDB(count);
  }

  /**
   * Search tours by destination
   */
  async searchToursByDestinationForAI(
    destination: string,
    limit = 10,
  ): Promise<TourForAI[]> {
    return searchToursByDestinationDB(destination, limit);
  }

  /**
   * Format tours for AI context
   */
  private formatToursForAI(tours: TourForAI[]): string {
    if (tours.length === 0) return "Аял олдсонгүй.";

    return tours
      .map((t, i) => {
        const price = (t.base_price || 0).toLocaleString("mn-MN");
        // Handle both departure_date and departuredate column names
        const departureDate = t.departure_date || t.departuredate;
        const date = departureDate
          ? new Date(departureDate).toISOString().split("T")[0]
          : "unknown";
        const duration = t.duration_day ? `${t.duration_day} days` : "unknown";

        return `
[${i + 1}]
title: ${t.title}
price: ${price}₮
duration: ${duration}
date: ${date}
seats: ${t.seats}
`;
      })
      .join("\n");
  }

  /**
   * Generate response (compatible with existing interface)
   */
  async generateResponse(
    userMessage: string,
    context?: {
      conversationHistory?: string[];
      userPreferences?: Record<string, unknown>;
    },
  ): Promise<string> {
    if (!this.isEnabled()) {
      return "Уучлаарай, AI тусгай ажиллахгүй байна. Та админтай холбоо барина уу.";
    }

    try {
      const tours = await this.getToursForAI(20);
      const toursContext = this.formatToursForAI(tours);
      const enhancedSystemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n---ХОЙВОЛТ ЗАСАЛ---\n${toursContext}\n---ТӨГСӨЛ---\n\nЭдгээрийг ашиглан хэрэглэгчид тусална уу. Үнэ харьцуулахдаа бодит base_price-аар тооцоо.`;

      // Build messages array
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: enhancedSystemPrompt,
        },
        {
          role: "assistant",
          content: "Сайн байна уу! Би танд аялалын зөвлөхөнд тусална. Ямар улс/хотруу явахыг хүсэж байна вэ?",
        },
      ];

      // Add conversation history
      if (context?.conversationHistory) {
        for (const msg of context.conversationHistory.slice(-10)) {
          const role = msg.startsWith("Bot:") ? "assistant" : "user";
          const content = msg.replace(/^(Bot:|User:)\s*/, "");
          messages.push({ role, content });
        }
      }

      // Add current user message
      messages.push({
        role: "user",
        content: userMessage,
      });

      return await this.generateAIResponse(messages);
    } catch (error) {
      logger.error("Groq generateResponse error", error);
      return "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.";
    }
  }

  /**
   * Extract booking details from message
   */
  async extractBookingDetails(userMessage: string): Promise<BookingDetails> {
    if (!this.isEnabled()) return {};

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
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: "Та нь JSON форматад мэргэшсэн туслах. Зөвхөн JSON гаргана.",
        },
        {
          role: "user",
          content: extractionPrompt,
        },
      ];

      const response = await this.generateAIResponse(messages);
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
    } catch (error) {
      logger.warn("extractBookingDetails parsing failed", error);
    }
    return {};
  }

  /**
   * Generate follow-up question
   */
  async generateFollowUp(
    currentDetails: BookingDetails,
    missingFields: string[],
  ): Promise<string> {
    const suggestions: string[] = [];
    if (missingFields.includes("destination"))
      suggestions.push("Ямар улс/хотруу явах вэ?");
    if (missingFields.includes("dates")) suggestions.push("Хэдийд явах вэ?");
    if (missingFields.includes("people"))
      suggestions.push("Хэдэн хүн явах вэ?");
    if (missingFields.includes("hotelType"))
      suggestions.push("Ямар зочид буудал сонгох вэ? (3★, 4★, 5★)");
    if (missingFields.includes("flightClass"))
      suggestions.push("Ямар нислэг сонгох вэ? (economy, business, first)");
    return suggestions.join(" ") || "Та өөр асуух зүйл байна уу?";
  }

  /**
   * Generate quote summary
   */
  async generateQuoteSummary(
    details: BookingDetails,
    totalPrice: number,
  ): Promise<string> {
    const breakdown: string[] = [];
    breakdown.push(`📍 ${details.destination || "Зорилго тодорхойгүй"}`);
    if (details.startDate && details.endDate)
      breakdown.push(`📅 ${details.startDate} - ${details.endDate}`);
    if (details.people) breakdown.push(`👥 ${details.people} хүн`);
    if (details.hotelType) {
      const stars = { "3star": "3★", "4star": "4★", "5star": "5★" };
      breakdown.push(`🏨 Зочид буудал: ${stars[details.hotelType]}`);
    }
    if (details.flightClass)
      breakdown.push(`✈️ Нислэг: ${details.flightClass}`);
    if (details.activities?.length)
      breakdown.push(`📋 ${details.activities.join(", ")}`);
    breakdown.push(`\n💰 Нийт: ${totalPrice.toLocaleString("mn-MN")}₮`);
    return breakdown.join("\n");
  }

  /**
   * Generate tour recommendation
   */
  async generateTourRecommendation(
    userMessage: string,
    tours: TourForAI[],
    intentContext: string,
    context?: {
      conversationHistory?: string[];
      userPreferences?: Record<string, unknown>;
    },
  ): Promise<string> {
    if (!this.isEnabled()) {
      return "Уучлаарай, AI тусгай ажиллахгүй байна. Та админтай холбоо барина уу.";
    }

    try {
      const toursList = tours
        .map(
          (t, i) => {
            const departureDate = t.departure_date || t.departuredate;
            const duration = t.duration_day ? `${t.duration_day} хоног` : "Тодорхойгүй";
            return `
[${i + 1}]
${t.title}
💰 ${(t.base_price || 0).toLocaleString()}₮
📅 ${departureDate || "N/A"}
⏱ ${duration}
💺 ${t.seats}
`;
          },
        )
        .join("\n");

      const prompt = RECOMMENDATION_SYSTEM_PROMPT.replace(
        "{AUTHORED_TOURS}",
        toursList,
      )
        .replace("{INTENT_CONTEXT}", intentContext || RECOMMENDATION_FALLBACK)
        .replace("{USER_MESSAGE}", userMessage);

      // Build messages array
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "assistant",
          content: "Сайн байна уу! Би танд аялалын зөвлөхөнд тусална.",
        },
      ];

      // Add conversation history
      if (context?.conversationHistory) {
        for (const msg of context.conversationHistory.slice(-5)) {
          const role = msg.startsWith("Bot:") ? "assistant" : "user";
          const content = msg.replace(/^(Bot:|User:)\s*/, "");
          messages.push({ role, content });
        }
      }

      // Add current user message
      messages.push({
        role: "user",
        content: userMessage,
      });

      return await this.generateAIResponse(messages);
    } catch (error) {
      logger.error("Groq generateTourRecommendation error", error);
      return (
        RECOMMENDATION_FALLBACK +
        "\n\n" +
        tours
          .slice(0, 3)
          .map(
            (t, i) =>
              `${i + 1}. ${t.title} - ${(t.base_price || 0).toLocaleString()}₮`,
          )
          .join("\n")
      );
    }
  }

  /**
   * Generate greeting
   */
  async generateGreeting(
    userPreferences?: Record<string, unknown>,
  ): Promise<string> {
    const tours = await this.getToursForAI(5);
    const cheapestTour = tours[0];
    const priceStr = cheapestTour
      ? (cheapestTour.base_price || 0).toLocaleString("mn-MN") + "₮"
      : "";
    const greetings = [
      "Сайн байна уу! Би танд аялалын зөвлөхөнд тусална. " +
        (cheapestTour
          ? "Одоогоор хамгийн хямд аял бол " +
            cheapestTour.title +
            " - " +
            priceStr +
            " байна."
          : ""),
      "Сайн байна уу! Ямар аялал хүсэж байна вэ? " +
        (cheapestTour ? "Хамгийн хямд вариант: " + cheapestTour.title : ""),
    ];
    if (userPreferences?.lastDestination)
      return (
        "Сайн байна уу! " +
        userPreferences.lastDestination +
        " руу дахин явахыг хүсэж байна уу?"
      );
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
}

// Export singleton instance
export const groqClient = new GroqClient();

// Export legacy alias for compatibility
export const geminiClient = groqClient;