/**
 * Hybrid Router for Chatbot
 *
 * This module intelligently routes messages between FSM and AI based on
 * input classification and conversation context.
 */

import { BotState, ChatContext } from "./fsm.service.js";
import { classifyInput, InputClassification } from "./inputClassifier.js";
import { enhancedFsmService, EnhancedFSMResponse } from "./enhancedFsm.service.js";
import { groqClient } from "../../integrations/groq/groq.client.js";
import { TourForAI } from "../../integrations/groq/groq.client.js";
import { logger } from "../../shared/logger.js";

export interface RouteDecision {
  useFSM: boolean;
  useAI: boolean;
  primaryMode: "FSM" | "AI" | "HYBRID";
  reasoning: string;
}

export interface HybridResponse {
  reply: string;
  newState: BotState;
  usedFSM: boolean;
  usedAI: boolean;
  isFSMTriggered: boolean;
  tours?: TourForAI[];
  intentType?: string;
  aiData?: any;
  needsUserAction: boolean;
  suggestedActions?: string[];
  conversationContext?: ChatContext;
}

export class HybridRouter {
  private currentContext: ChatContext = {
    state: BotState.IDLE,
  };

  /**
   * Main routing function - decides how to process the message
   */
  async routeMessage(
    message: string,
    context?: ChatContext,
    conversationHistory?: string[]
  ): Promise<HybridResponse> {
    // Update current context
    if (context) {
      this.currentContext = { ...this.currentContext, ...context };
    }

    // Classify the input
    const classification = classifyInput(
      message,
      this.currentContext.state,
      this.getExpectedFormatForState(this.currentContext.state)
    );

    logger.info("Hybrid Router Classification", {
      message,
      classification: {
        type: classification.type,
        intent: classification.intent,
        confidence: classification.confidence,
        isFSMTrigger: classification.isFSMTrigger,
      },
      currentState: this.currentContext.state,
    });

    // Make routing decision
    const routeDecision = this.makeRoutingDecision(classification);

    logger.info("Routing Decision", routeDecision);

    // Process based on decision
    switch (routeDecision.primaryMode) {
      case "FSM":
        return await this.processWithFSM(message, classification);
      case "AI":
        return await this.processWithAI(message, classification, conversationHistory);
      case "HYBRID":
        return await this.processWithHybrid(message, classification, conversationHistory);
      default:
        return await this.processWithAI(message, classification, conversationHistory);
    }
  }

  /**
   * Make routing decision based on classification
   */
  private makeRoutingDecision(classification: InputClassification): RouteDecision {
    const { type, intent, isFSMTrigger, shouldUseFSM, shouldUseAI } = classification;

    // Explicit FSM trigger
    if (isFSMTrigger) {
      return {
        useFSM: true,
        useAI: false,
        primaryMode: "FSM",
        reasoning: "Explicit FSM trigger keyword detected",
      };
    }

    // Structured input with clear data
    if (type === "STRUCTURED" && shouldUseFSM) {
      return {
        useFSM: true,
        useAI: false,
        primaryMode: "FSM",
        reasoning: "Structured input with clear data",
      };
    }

    // Conversational input
    if (type === "CONVERSATIONAL" && shouldUseAI) {
      return {
        useFSM: false,
        useAI: true,
        primaryMode: "AI",
        reasoning: "Conversational input detected",
      };
    }

    // Mixed input - use both
    if (type === "MIXED") {
      return {
        useFSM: true,
        useAI: true,
        primaryMode: "HYBRID",
        reasoning: "Mixed structured and conversational content",
      };
    }

    // Questions always use AI
    if (intent === "question") {
      return {
        useFSM: false,
        useAI: true,
        primaryMode: "AI",
        reasoning: "Question detected",
      };
    }

    // Greetings use AI
    if (intent === "greeting") {
      return {
        useFSM: false,
        useAI: true,
        primaryMode: "AI",
        reasoning: "Greeting detected",
      };
    }

    // Help requests use AI
    if (intent === "help") {
      return {
        useFSM: false,
        useAI: true,
        primaryMode: "AI",
        reasoning: "Help request detected",
      };
    }

    // Default to AI for better UX
    return {
      useFSM: false,
      useAI: true,
      primaryMode: "AI",
      reasoning: "Default to AI for better user experience",
    };
  }

  /**
   * Process message with FSM
   */
  private async processWithFSM(
    message: string,
    classification: InputClassification
  ): Promise<HybridResponse> {
    try {
      const fsmResponse = await enhancedFsmService.processMessage(
        message,
        this.currentContext
      );

      // Update context if state changed
      if (fsmResponse.newState !== this.currentContext.state) {
        this.currentContext.state = fsmResponse.newState;
      }

      return {
        reply: fsmResponse.reply,
        newState: fsmResponse.newState,
        usedFSM: true,
        usedAI: fsmResponse.usedAI,
        isFSMTriggered: fsmResponse.isFSMTriggered,
        needsUserAction: fsmResponse.needsUserAction,
        suggestedActions: fsmResponse.suggestedActions,
        conversationContext: this.currentContext,
      };
    } catch (error) {
      logger.error("FSM processing error", error);
      return await this.getFallbackResponse(message, classification);
    }
  }

  /**
   * Process message with AI
   */
  private async processWithAI(
    message: string,
    classification: InputClassification,
    conversationHistory?: string[]
  ): Promise<HybridResponse> {
    try {
      // Detect intent for AI
      const intent = this.detectIntent(message);

      // Get tours if needed
      let tours: TourForAI[] = [];
      if (this.shouldFetchTours(intent)) {
        tours = await groqClient.getToursForAI(20);
      }

      // Generate AI response
      let aiReply: string;
      if (intent === "tour_query" || intent === "cheapest" || intent === "recommend") {
        // Use tour recommendation
        aiReply = await this.generateTourRecommendation(message, tours, intent);
      } else {
        // Use general AI response
        aiReply = await groqClient.generateResponse(message, {
          conversationHistory,
          userPreferences: {
            currentState: this.currentContext.state,
            selectedTour: this.currentContext.selectedTour,
          },
        });
      }

      return {
        reply: aiReply,
        newState: this.currentContext.state,
        usedFSM: false,
        usedAI: true,
        isFSMTriggered: false,
        tours: tours.length > 0 ? tours : undefined,
        intentType: intent,
        needsUserAction: true,
        suggestedActions: this.getSuggestedActionsForIntent(intent),
        conversationContext: this.currentContext,
      };
    } catch (error) {
      logger.error("AI processing error", error);
      return await this.getFallbackResponse(message, classification);
    }
  }

  /**
   * Process message with hybrid approach
   */
  private async processWithHybrid(
    message: string,
    classification: InputClassification,
    conversationHistory?: string[]
  ): Promise<HybridResponse> {
    try {
      // First, try to process structured part with FSM
      const fsmResponse = await enhancedFsmService.processMessage(
        message,
        this.currentContext
      );

      // Then, get AI response for conversational part
      const aiResponse = await groqClient.generateResponse(message, {
        conversationHistory,
        userPreferences: {
          currentState: this.currentContext.state,
          selectedTour: this.currentContext.selectedTour,
        },
      });

      // Combine responses
      const combinedReply = this.combineResponses(fsmResponse.reply, aiResponse);

      // Update context if state changed
      if (fsmResponse.newState !== this.currentContext.state) {
        this.currentContext.state = fsmResponse.newState;
      }

      return {
        reply: combinedReply,
        newState: fsmResponse.newState,
        usedFSM: true,
        usedAI: true,
        isFSMTriggered: fsmResponse.isFSMTriggered,
        needsUserAction: fsmResponse.needsUserAction,
        suggestedActions: fsmResponse.suggestedActions,
        conversationContext: this.currentContext,
      };
    } catch (error) {
      logger.error("Hybrid processing error", error);
      return await this.getFallbackResponse(message, classification);
    }
  }

  /**
   * Generate tour recommendation
   */
  private async generateTourRecommendation(
    message: string,
    tours: TourForAI[],
    intent: string
  ): Promise<string> {
    // Filter and sort tours based on intent
    let filteredTours = [...tours];

    if (intent === "cheapest") {
      filteredTours.sort((a, b) => a.base_price - b.base_price);
      filteredTours = filteredTours.slice(0, 5);
    } else if (intent === "recommend") {
      // Sort by value (price/duration ratio)
      filteredTours.sort((a, b) => {
        const durationA = a.duration_day || 1; // Default to 1 if undefined
        const durationB = b.duration_day || 1;
        const scoreA = a.base_price / durationA;
        const scoreB = b.base_price / durationB;
        return scoreA - scoreB;
      });
      filteredTours = filteredTours.slice(0, 5);
    }

    // Generate AI response with tours
    const intentContext = this.buildIntentContext(intent);
    return await groqClient.generateTourRecommendation(
      message,
      filteredTours,
      intentContext
    );
  }

  /**
   * Build intent context for AI
   */
  private buildIntentContext(intent: string): string {
    const contexts: Record<string, string> = {
      cheapest: `
ЗАСАЛ: Хэрэглэгч хамгийн хямд/үнэтэй аялыг асууж байна.
- Түүхнээсээ хамгийн доод үнэтэй аялыг олоорой
- Үнийг тодотгосонтойгоор харуулах
- "Хамгийн хямд" гэдгийг тусгайлан тэмдэглэх
`,
      recommend: `
ЗАСАЛ: Хэрэглэгч зөвлөх/санал болгохыг хүсэж байна.
- Тус бүрийн давуу талыг товч тайлбарлах
- Яагаад тэр аялыг санал болгож байгааг тайлбарлах
- Хэрэглэгчийн хэрэгцээнд тохирох эсэхийг анхаарах
`,
      best: `
ЗАСАЛ: Хэрэглэгч хамгийн сайн/шилдэг аялыг асууж байна.
- Үнэ болон чанарыг хослуулан үнэлэх
- Хамгийн өндөр үнэ цэнэтэй аялыг санал болгох
- Онцлог давуу талуудыг тодотгох
`,
    };

    return contexts[intent] || "";
  }

  /**
   * Detect intent from message
   */
  private detectIntent(message: string): string {
    const lowerMsg = message.toLowerCase();

    // Tour-related keywords
    const tourKeywords = [
      "аял",
      "tour",
      "travel",
      "trip",
      "cheap",
      "expensive",
      "best",
      "хамгийн",
      "хямд",
      "үнэтэй",
      "чиглэл",
      "суудал",
      "яв",
      "аялах",
    ];

    const hasTourKeyword = tourKeywords.some((k) => lowerMsg.includes(k));

    if (hasTourKeyword) {
      if (lowerMsg.includes("хямд") || lowerMsg.includes("cheap")) {
        return "cheapest";
      }
      if (lowerMsg.includes("шилдэг") || lowerMsg.includes("best")) {
        return "best";
      }
      if (
        lowerMsg.includes("зөвлө") ||
        lowerMsg.includes("санал") ||
        lowerMsg.includes("recommend")
      ) {
        return "recommend";
      }
      return "tour_query";
    }

    return "general";
  }

  /**
   * Check if we should fetch tours for this intent
   */
  private shouldFetchTours(intent: string): boolean {
    return ["tour_query", "cheapest", "recommend", "best"].includes(intent);
  }

  /**
   * Get suggested actions for intent
   */
  private getSuggestedActionsForIntent(intent: string): string[] {
    switch (intent) {
      case "tour_query":
        return [
          "Аялал сонгох",
          "Үнийн талаар асуух",
          "Огноо тодорхойлох",
        ];
      case "cheapest":
        return [
          "Хамгийн хямд аялал сонгох",
          "Үнийн дэлгэрэнгүй мэдээлэл",
        ];
      case "recommend":
        return [
          "Санал болгосон аялал сонгох",
          "Өөр сонолт харах",
        ];
      default:
        return [
          "Асуулт асуух",
          "Захиалга эхлүүлэх",
        ];
    }
  }

  /**
   * Combine FSM and AI responses
   */
  private combineResponses(fsmReply: string, aiReply: string): string {
    if (!fsmReply) return aiReply;
    if (!aiReply) return fsmReply;

    // If FSM reply is short, append AI response
    if (fsmReply.length < 100) {
      return `${fsmReply}\n\n${aiReply}`;
    }

    // Otherwise, prioritize AI response but include FSM context
    return `${aiReply}\n\n${fsmReply}`;
  }

  /**
   * Get fallback response
   */
  private async getFallbackResponse(
    message: string,
    classification: InputClassification
  ): Promise<HybridResponse> {
    return {
      reply: "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.",
      newState: this.currentContext.state,
      usedFSM: false,
      usedAI: false,
      isFSMTriggered: false,
      needsUserAction: true,
      conversationContext: this.currentContext,
    };
  }

  /**
   * Get expected format for current state
   */
  private getExpectedFormatForState(state: BotState): any {
    switch (state) {
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return "SELECTION";
      case BotState.WAITING_FOR_DATE:
        return "DATE";
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return "NUMBER";
      default:
        return "ANY";
    }
  }

  /**
   * Update current context
   */
  updateContext(context: Partial<ChatContext>) {
    this.currentContext = { ...this.currentContext, ...context };
  }

  /**
   * Get current context
   */
  getCurrentContext(): ChatContext {
    return { ...this.currentContext };
  }

  /**
   * Reset context
   */
  resetContext() {
    this.currentContext = {
      state: BotState.IDLE,
    };
  }
}

export const hybridRouter = new HybridRouter();