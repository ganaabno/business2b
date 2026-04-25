import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { badRequest } from "../../shared/http/errors.js";
import { geminiClient } from "../../integrations/gemini/gemini.client.js";
import type { Request, Response } from "express";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.post(
  "/ai",
  asyncHandler(async (req: Request, res: Response) => {
    const { message, context } = req.body as {
      message?: string;
      context?: {
        conversationHistory?: string[];
        userPreferences?: Record<string, unknown>;
      };
    };

    if (!message || typeof message !== "string") {
      throw badRequest("Message is required");
    }

    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    // Check if message is tour-related
    const tourKeywords = [
      'аял', 'tour', 'travel', 'trip', 'cheap', 'expensive', 'best',
      'хамгийн', 'хямд', 'үнэтэй', 'чиглэл', 'суудал',
      'thailand', 'japan', 'korea', 'vietnam', 'china', 'singapore',
      'москва', 'дубай', 'турк', 'явчих', 'явна', 'явдаг'
    ];
    
    const normalizedMessage = message.toLowerCase();
    const isTourQuery = tourKeywords.some(k => normalizedMessage.includes(k));
    
    let result: {
      reply: string;
      tours?: Array<{
        id: string;
        title: string;
        destination: string;
        base_price: number;
        departure_date: string;
        duration_day: number;
        seats: number;
      }>;
      type: 'tour_results' | 'conversation';
      suggestions?: string[];
    } = { reply: '', type: 'conversation' };
    
    if (isTourQuery) {
      // Fetch tours based on query
      const tours = await geminiClient.getToursForAI(10);
      
      // Filter based on query if needed
      let filteredTours = tours;
      
      if (normalizedMessage.includes('хамгийн') || normalizedMessage.includes('хямд') || normalizedMessage.includes('cheap')) {
        filteredTours = tours.slice(0, 5);
        result.type = 'tour_results';
      } else if (normalizedMessage.includes('thailand') || normalizedMessage.includes('тайланд')) {
        filteredTours = tours.filter(t => 
          t.destination?.toLowerCase().includes('thailand') || 
          t.title?.toLowerCase().includes('thailand')
        ).slice(0, 5);
        result.type = 'tour_results';
      } else if (normalizedMessage.includes('japan') || normalizedMessage.includes('солонгос')) {
        filteredTours = tours.filter(t => 
          t.destination?.toLowerCase().includes('japan') || 
          t.title?.toLowerCase().includes('japan')
        ).slice(0, 5);
        result.type = 'tour_results';
      } else if (normalizedMessage.includes('vietnam') || normalizedMessage.includes('вьетнам')) {
        filteredTours = tours.filter(t => 
          t.destination?.toLowerCase().includes('vietnam') || 
          t.title?.toLowerCase().includes('vietnam')
        ).slice(0, 5);
        result.type = 'tour_results';
      }
      
      // Format tour data
      result.tours = filteredTours.map(t => ({
        id: t.id,
        title: t.title,
        destination: t.destination,
        base_price: t.base_price,
        departure_date: t.departure_date,
        duration_day: t.duration_day,
        seats: t.seats
      }));
      
      // Generate friendly response text
      if (result.tours.length > 0) {
        if (result.type === 'tour_results' && (normalizedMessage.includes('хамгийн') || normalizedMessage.includes('хямд') || normalizedMessage.includes('cheap'))) {
          result.reply = `🎯 Таны хүсэлтэд нийцүүлэн хамгийн хямд ${result.tours.length} аялыг олж авлаа:\n\n`;
        } else {
          result.reply = `🎯 Одоогоор идэвхтэй ${result.tours.length} аял олдлоо:\n\n`;
        }
        
        // Add tour names to reply for history
        result.tours.forEach((t, i) => {
          result.reply += `${i + 1}. ${t.title} - ${(t.base_price || 0).toLocaleString()}₮\n`;
        });
        
        result.suggestions = [
          "Дэлгэрэнгүй аврах",
          "Өөр чиглэл хайх",
          "Үнэ тооцоо хийх"
        ];
      } else {
        result.reply = "Уучлаарай, таны хүсэлтэд нийцэх аял олдсонгүй. Өөр чиглэл сонгоно уу?";
      }
    } else {
      // Normal conversation
      const reply = await geminiClient.generateResponse(message, context);
      result.reply = reply;
    }

    res.json(result);
  }),
);

chatRouter.get(
  "/tours",
  asyncHandler(async (req: Request, res: Response) => {
    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const tours = await geminiClient.getToursForAI(limit);

    res.json({ tours });
  }),
);

chatRouter.get(
  "/tours/cheapest",
  asyncHandler(async (req: Request, res: Response) => {
    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    const count = parseInt(req.query.count as string) || 5;
    const tours = await geminiClient.getCheapestToursForAI(count);

    res.json({ tours });
  }),
);

chatRouter.get(
  "/tours/search",
  asyncHandler(async (req: Request, res: Response) => {
    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    const destination = req.query.destination as string;
    if (!destination) {
      throw badRequest("destination is required");
    }

    const tours = await geminiClient.searchToursByDestinationForAI(destination);

    res.json({ tours });
  }),
);

chatRouter.post(
  "/ai/extract",
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };

    if (!message || typeof message !== "string") {
      throw badRequest("Message is required");
    }

    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    const details = await geminiClient.extractBookingDetails(message);

    res.json({ details });
  }),
);

chatRouter.post(
  "/ai/greeting",
  asyncHandler(async (req: Request, res: Response) => {
    const { userPreferences } = req.body as {
      userPreferences?: Record<string, unknown>;
    };

    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    const greeting = await geminiClient.generateGreeting(userPreferences);

    res.json({ greeting });
  }),
);

chatRouter.post(
  "/ai/follow-up",
  asyncHandler(async (req: Request, res: Response) => {
    const { currentDetails, missingFields } = req.body as {
      currentDetails?: Record<string, unknown>;
      missingFields?: string[];
    };

    if (!geminiClient.isEnabled()) {
      throw badRequest("AI service is not configured");
    }

    const followUp = await geminiClient.generateFollowUp(
      currentDetails as any,
      missingFields || [],
    );

    res.json({ followUp });
  }),
);