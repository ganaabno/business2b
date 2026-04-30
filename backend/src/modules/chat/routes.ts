import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { asyncHandler } from "../../shared/http/asyncHandler.js";
import { badRequest, serviceUnavailable } from "../../shared/http/errors.js";
import { groqClient } from "../../integrations/groq/groq.client.js";
import { logger } from "../../shared/logger.js";
import type { Request, Response } from "express";
import { TourForAI, BookingDetails } from "../../integrations/groq/groq.client.js";
import { fsmService, BotState, ChatContext } from "./fsm.service.js";
import { hybridRouter, HybridResponse } from "./hybridRouter.js";

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
        chatContext?: ChatContext;
      };
    };

    if (!message || typeof message !== "string") {
      throw badRequest("Мессеж шаардлагатай");
    }

    if (!groqClient.isEnabled()) {
      logger.warn("Chat AI called but Groq not configured");
      throw serviceUnavailable("AI ажиллахгүй байна.");
    }

    logger.info("🤖 Hybrid Chat Processing", { message });

    try {
      // Use the hybrid router for intelligent processing
      const hybridResponse: HybridResponse = await hybridRouter.routeMessage(
        message,
        context?.chatContext,
        context?.conversationHistory
      );

      // Update the router's context if provided
      if (context?.chatContext) {
        hybridRouter.updateContext(context.chatContext);
      }

      // Format the response for the frontend
      const response = {
        reply: hybridResponse.reply,
        type: hybridResponse.usedFSM ? "fsm_response" : "conversation",
        isAIGenerative: hybridResponse.usedAI,
        chatContext: hybridResponse.conversationContext,
        tours: hybridResponse.tours,
        intentType: hybridResponse.intentType,
        aiData: hybridResponse.aiData,
        suggestedActions: hybridResponse.suggestedActions,
        needsUserAction: hybridResponse.needsUserAction,
        routingInfo: {
          usedFSM: hybridResponse.usedFSM,
          usedAI: hybridResponse.usedAI,
          isFSMTriggered: hybridResponse.isFSMTriggered,
          newState: hybridResponse.newState,
        },
      };

      logger.info("🤖 Hybrid Chat Response", {
        routingInfo: response.routingInfo,
        hasTours: !!hybridResponse.tours,
        intentType: hybridResponse.intentType,
      });

      res.json(response);
    } catch (error) {
      logger.error("🔥 Hybrid Chat Error", error);

      // Fallback to basic AI response
      try {
        const fallbackResponse = await groqClient.generateResponse(message, context);
        res.json({
          reply: fallbackResponse,
          type: "conversation",
          isAIGenerative: true,
          chatContext: hybridRouter.getCurrentContext(),
          routingInfo: {
            usedFSM: false,
            usedAI: true,
            isFSMTriggered: false,
            newState: BotState.IDLE,
          },
        });
      } catch (fallbackError) {
        logger.error("🔥 Fallback AI Error", fallbackError);
        throw serviceUnavailable("AI ажиллахгүй байна.");
      }
    }
  }),
);

chatRouter.get(
  "/tours",
  asyncHandler(async (req: Request, res: Response) => {
    if (!groqClient.isEnabled()) {
      throw serviceUnavailable("AI тусгай ажиллахгүй байна");
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const tours = await groqClient.getToursForAI(limit);

    res.json({ tours });
  }),
);

chatRouter.get(
  "/tours/cheapest",
  asyncHandler(async (req: Request, res: Response) => {
    if (!groqClient.isEnabled()) {
      throw serviceUnavailable("AI тусгай ажиллахгүй байна");
    }

    const count = parseInt(req.query.count as string) || 5;
    const tours = await groqClient.getCheapestToursForAI(count);

    res.json({ tours });
  }),
);

chatRouter.get(
  "/tours/search",
  asyncHandler(async (req: Request, res: Response) => {
    if (!groqClient.isEnabled()) {
      throw serviceUnavailable("AI тусгай ажиллахгүй байна");
    }

    const destination = req.query.destination as string;
    if (!destination) {
      throw badRequest("чиглэл шаардлагатай");
    }

    const tours = await groqClient.searchToursByDestinationForAI(destination);

    res.json({ tours });
  }),
);

chatRouter.post(
  "/ai/extract",
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = req.body as { message?: string };

    if (!message || typeof message !== "string") {
      throw badRequest("Мессеж шаардлагатай");
    }

    if (!groqClient.isEnabled()) {
      throw serviceUnavailable("AI тусгай ажиллахгүй байна");
    }

    const details = await groqClient.extractBookingDetails(message);

    res.json({ details });
  }),
);

chatRouter.post(
  "/ai/greeting",
  asyncHandler(async (req: Request, res: Response) => {
    const { userPreferences } = req.body as {
      userPreferences?: Record<string, unknown>;
    };

    if (!groqClient.isEnabled()) {
      throw serviceUnavailable("AI тусгай ажиллахгүй байна");
    }

    const greeting = await groqClient.generateGreeting(userPreferences);

    res.json({ greeting, isAIGenerative: true });
  }),
);

chatRouter.post(
  "/ai/follow-up",
  asyncHandler(async (req: Request, res: Response) => {
    const { currentDetails, missingFields } = req.body as {
      currentDetails?: Record<string, unknown>;
      missingFields?: string[];
    };

    if (!groqClient.isEnabled()) {
      throw serviceUnavailable("AI тусгай ажиллахгүй байна");
    }

    const followUp = await groqClient.generateFollowUp(
      currentDetails as BookingDetails,
      missingFields || [],
    );

    res.json({ followUp, isAIGenerative: true });
  }),
);

// Get current chat context
chatRouter.get(
  "/context",
  asyncHandler(async (req: Request, res: Response) => {
    const currentContext = hybridRouter.getCurrentContext();
    res.json({ context: currentContext });
  }),
);

// Reset chat context
chatRouter.post(
  "/context/reset",
  asyncHandler(async (req: Request, res: Response) => {
    hybridRouter.resetContext();
    res.json({ success: true, message: "Chat context reset successfully" });
  }),
);

// Update chat context
chatRouter.post(
  "/context",
  asyncHandler(async (req: Request, res: Response) => {
    const { context } = req.body as { context?: Partial<ChatContext> };

    if (context) {
      hybridRouter.updateContext(context);
    }

    const updatedContext = hybridRouter.getCurrentContext();
    res.json({ context: updatedContext });
  }),
);
