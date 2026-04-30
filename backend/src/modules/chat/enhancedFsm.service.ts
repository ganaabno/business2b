/**
 * Enhanced FSM Service for Hybrid Chatbot
 *
 * This module extends the basic FSM with AI fallback capabilities,
 * allowing conversational inputs during structured booking flow.
 */

import { TourForAI } from "../../integrations/groq/groq.client.js";
import { BotState, ChatContext, FSMResponse } from "./fsm.service.js";
import { groqClient } from "../../integrations/groq/groq.client.js";
import {
  buildAIContext,
  generateStateAwarePrompt,
} from "./aiContextManager.js";
import { logger } from "../../shared/logger.js";

export interface EnhancedFSMResponse extends FSMResponse {
  usedAI: boolean;
  aiResponse?: string;
  needsUserAction: boolean;
  suggestedActions?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  extractedValue?: any;
}

export class EnhancedFSMService {
  private tours: TourForAI[] = [];

  setTours(tours: TourForAI[]) {
    this.tours = tours;
  }

  /**
   * Process message with AI fallback for conversational inputs
   */
  async processMessage(
    message: string,
    context: ChatContext,
    conversationHistory?: string[]
  ): Promise<EnhancedFSMResponse> {
    const lowerMsg = message.toLowerCase();

    // Check if this is a structured input for the current state
    const validationResult = this.validateInputForState(message, context.state);

    if (validationResult.isValid) {
      // Process with FSM
      return this.processStructuredInput(
        message,
        context,
        validationResult.extractedValue
      );
    } else {
      // Use AI for conversational input
      return this.processConversationalInput(
        message,
        context,
        validationResult.error,
        conversationHistory
      );
    }
  }

  /**
   * Validate input based on current state
   */
  private validateInputForState(
    message: string,
    state: BotState
  ): ValidationResult {
    switch (state) {
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return this.validateTourSelection(message);
      case BotState.WAITING_FOR_DATE:
        return this.validateDateInput(message);
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return this.validateTravelersInput(message);
      default:
        return { isValid: true }; // No validation needed for other states
    }
  }

  /**
   * Process structured input through FSM
   */
  private processStructuredInput(
    message: string,
    context: ChatContext,
    extractedValue?: any
  ): EnhancedFSMResponse {
    const fsmResponse = this.processFSMState(message, context, extractedValue);

    return {
      ...fsmResponse,
      usedAI: false,
      needsUserAction: fsmResponse.newState !== BotState.BOOKING_CONFIRMED,
      suggestedActions: this.getSuggestedActions(fsmResponse.newState, context),
    };
  }

  /**
   * Process conversational input with AI
   */
  private async processConversationalInput(
    message: string,
    context: ChatContext,
    validationError?: string,
    conversationHistory?: string[]
  ): Promise<EnhancedFSMResponse> {
    try {
      // Build AI context with current state
      const aiContext = buildAIContext(context, message, conversationHistory);

      // Generate AI response
      const aiResponse = await groqClient.generateResponse(message, {
        conversationHistory,
        userPreferences: {
          currentState: context.state,
          selectedTour: context.selectedTour,
          bookingProgress: this.getBookingProgress(context),
        },
      });

      // Add helpful reminder about what's needed
      const enhancedResponse = this.enhanceAIResponseWithStateInfo(
        aiResponse,
        context,
        validationError
      );

      return {
        reply: enhancedResponse,
        newState: context.state, // Don't change state on conversational input
        isFSMTriggered: false,
        usedAI: true,
        aiResponse: aiResponse,
        needsUserAction: true,
        suggestedActions: this.getSuggestedActions(context.state, context),
      };
    } catch (error) {
      logger.error("AI processing error", error);

      // Fallback to basic response
      return {
        reply: this.getFallbackResponse(context.state, validationError),
        newState: context.state,
        isFSMTriggered: false,
        usedAI: false,
        needsUserAction: true,
        suggestedActions: this.getSuggestedActions(context.state, context),
      };
    }
  }

  /**
   * Process FSM state transitions
   */
  private processFSMState(
    message: string,
    context: ChatContext,
    extractedValue?: any
  ): FSMResponse {
    switch (context.state) {
      case BotState.IDLE:
        return this.handleIdleState(message, context);
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return this.handleTourSelection(message, context, extractedValue);
      case BotState.WAITING_FOR_DATE:
        return this.handleDateSelection(message, context, extractedValue);
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return this.handleTravelersSelection(message, context, extractedValue);
      case BotState.BOOKING_CONFIRMED:
        return this.handleBookingConfirmed(message, context);
      default:
        return this.handleDefaultState(message, context);
    }
  }

  /**
   * Handle idle state
   */
  private handleIdleState(
    message: string,
    context: ChatContext
  ): FSMResponse {
    const lowerMsg = message.toLowerCase();

    // Check for explicit FSM initiation keywords
    if (
      lowerMsg.includes("захиалах") ||
      lowerMsg.includes("номлох") ||
      lowerMsg.includes("аялал сонгох") ||
      lowerMsg.includes("booking") ||
      lowerMsg.includes("reserve")
    ) {
      return {
        reply: this.getTourSelectionPrompt(),
        newState: BotState.WAITING_FOR_TOUR_SELECTION,
        isFSMTriggered: true,
      };
    }

    // If not an FSM initiation, return empty to let AI handle it
    return {
      reply: "",
      newState: BotState.IDLE,
      isFSMTriggered: false,
    };
  }

  /**
   * Handle tour selection
   */
  private handleTourSelection(
    message: string,
    context: ChatContext,
    extractedValue?: number
  ): FSMResponse {
    const tourIndex = extractedValue || parseInt(message.trim());

    if (isNaN(tourIndex) || tourIndex < 1 || tourIndex > this.tours.length) {
      return {
        reply: `Буруу сонголт байна. Та 1-${this.tours.length} доторх тоог оруулна уу.`,
        newState: BotState.WAITING_FOR_TOUR_SELECTION,
        isFSMTriggered: true,
      };
    }

    const selectedTour = this.tours[tourIndex - 1];
    context.selectedTourId = selectedTour.id;
    context.selectedTour = selectedTour;

    return {
      reply: `Та ${selectedTour.title} аялалыг сонголоо. Хэзээ явах вэ? (YYYY-MM-DD)`,
      newState: BotState.WAITING_FOR_DATE,
      isFSMTriggered: true,
      data: { selectedTour },
    };
  }

  /**
   * Handle date selection
   */
  private handleDateSelection(
    message: string,
    context: ChatContext,
    extractedValue?: string
  ): FSMResponse {
    const dateStr = extractedValue || message.trim();
    const dateRegex = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;

    if (!dateRegex.test(dateStr)) {
      return {
        reply: "Буруу огноо байна. Та YYYY-MM-DD форматаар оруулна уу.",
        newState: BotState.WAITING_FOR_DATE,
        isFSMTriggered: true,
      };
    }

    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (isNaN(date.getTime())) {
      return {
        reply: "Буруу огноо байна. Та YYYY-MM-DD форматаар оруулна уу.",
        newState: BotState.WAITING_FOR_DATE,
        isFSMTriggered: true,
      };
    }

    // Check if date is in the future
    const now = new Date();
    if (date < now) {
      return {
        reply: "Өнгөрсөн огноо оруулсан байна. Ирээдүйн огноо оруулна уу.",
        newState: BotState.WAITING_FOR_DATE,
        isFSMTriggered: true,
      };
    }

    context.departureDate = dateStr;

    return {
      reply: `Та ${dateStr} огноог сонголоо. Хэдэн хүн явах вэ?`,
      newState: BotState.WAITING_FOR_NUM_TRAVELERS,
      isFSMTriggered: true,
      data: { departureDate: dateStr },
    };
  }

  /**
   * Handle travelers selection
   */
  private handleTravelersSelection(
    message: string,
    context: ChatContext,
    extractedValue?: number
  ): FSMResponse {
    const numTravelers = extractedValue || parseInt(message.trim());

    if (isNaN(numTravelers) || numTravelers < 1) {
      return {
        reply: "Хүний тоо буруу байна. Та эерэг тоо оруулна уу.",
        newState: BotState.WAITING_FOR_NUM_TRAVELERS,
        isFSMTriggered: true,
      };
    }

    // Check against available seats
    if (
      context.selectedTour?.seats !== undefined &&
      numTravelers > context.selectedTour.seats
    ) {
      return {
        reply: `Уучлаарай, сонгосон аялалд ердөө ${context.selectedTour.seats} суудал үлдсэн байна. ${context.selectedTour.seats} ба түүнээс бага тоо оруулна уу.`,
        newState: BotState.WAITING_FOR_NUM_TRAVELERS,
        isFSMTriggered: true,
      };
    }

    context.numberOfTravelers = numTravelers;

    return {
      reply: `Та ${context.selectedTour?.title} аялалд ${context.departureDate} өдөр ${numTravelers} хүнтэй явах захиалга хийлээ.`,
      newState: BotState.BOOKING_CONFIRMED,
      isFSMTriggered: true,
      data: { numberOfTravelers: numTravelers },
    };
  }

  /**
   * Handle booking confirmed state
   */
  private handleBookingConfirmed(
    message: string,
    context: ChatContext
  ): FSMResponse {
    const lowerMsg = message.toLowerCase();

    // Check if user wants to start over
    if (
      lowerMsg.includes("дахин") ||
      lowerMsg.includes("шинэ") ||
      lowerMsg.includes("again") ||
      lowerMsg.includes("new")
    ) {
      // Reset context
      context.selectedTourId = undefined;
      context.selectedTour = undefined;
      context.departureDate = undefined;
      context.numberOfTravelers = undefined;

      return {
        reply: this.getTourSelectionPrompt(),
        newState: BotState.WAITING_FOR_TOUR_SELECTION,
        isFSMTriggered: true,
      };
    }

    return {
      reply: "Таны захиалга баталгаажсан. Та өөр асуух зүйл байна уу?",
      newState: BotState.IDLE,
      isFSMTriggered: true,
    };
  }

  /**
   * Handle default state
   */
  private handleDefaultState(
    message: string,
    context: ChatContext
  ): FSMResponse {
    return {
      reply: "Уучлаарай, би таны хүсэлтийг ойлгосонгүй.",
      newState: BotState.IDLE,
      isFSMTriggered: false,
    };
  }

  /**
   * Validation methods
   */
  private validateTourSelection(message: string): ValidationResult {
    const tourIndex = parseInt(message.trim());

    if (isNaN(tourIndex)) {
      return { isValid: false, error: "Тоо оруулна уу" };
    }

    if (tourIndex < 1 || tourIndex > this.tours.length) {
      return {
        isValid: false,
        error: `1-${this.tours.length} доторх тоог оруулна уу`,
      };
    }

    return { isValid: true, extractedValue: tourIndex };
  }

  private validateDateInput(message: string): ValidationResult {
    const trimmed = message.trim();
    const dateRegex = /^(\d{4})[-/](\d{2})[-/](\d{2})$/;

    if (!dateRegex.test(trimmed)) {
      return {
        isValid: false,
        error: "Огноог YYYY-MM-DD форматаар оруулна уу",
      };
    }

    const [, year, month, day] = trimmed.match(dateRegex) || [];
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    if (isNaN(date.getTime())) {
      return { isValid: false, error: "Буруу огноо байна" };
    }

    return { isValid: true, extractedValue: trimmed };
  }

  private validateTravelersInput(message: string): ValidationResult {
    const numTravelers = parseInt(message.trim());

    if (isNaN(numTravelers) || numTravelers < 1) {
      return { isValid: false, error: "Эерэг тоо оруулна уу" };
    }

    return { isValid: true, extractedValue: numTravelers };
  }

  /**
   * Helper methods
   */
  private getTourSelectionPrompt(): string {
    if (this.tours.length === 0) {
      return "Уучлаарай, одоогоор идэвхтэй аял байхгүй байна.";
    }

    let prompt = "Та дараах аялуудаас сонгоно уу:\n\n";
    this.tours.forEach((tour, index) => {
      const price = (tour.base_price || 0).toLocaleString("mn-MN");
      prompt += `${index + 1}. ${tour.title} - ${price}₮ (${tour.duration_day} хоног)\n`;
    });
    prompt += "\nСонголтын дугаараа оруулна уу (жишээ: 1)";

    return prompt;
  }

  private enhanceAIResponseWithStateInfo(
    aiResponse: string,
    context: ChatContext,
    validationError?: string
  ): string {
    let enhanced = aiResponse;

    // Add validation error context if present
    if (validationError) {
      enhanced = `${validationError}\n\n${enhanced}`;
    }

    // Add helpful reminder about current state
    const stateReminder = this.getStateReminder(context.state, context);
    if (stateReminder) {
      enhanced = `${enhanced}\n\n${stateReminder}`;
    }

    return enhanced;
  }

  private getStateReminder(state: BotState, context: ChatContext): string {
    switch (state) {
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return "💡 Аялал сонгохын тулд дээрх жагсаалтаас тоо оруулна уу.";
      case BotState.WAITING_FOR_DATE:
        return "💡 Огноо оруулахын тулд YYYY-MM-DD форматаар бичнэ үү (жишээ: 2026-06-01)";
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return "💡 Хүний тоо оруулна уу (жишээ: 2)";
      default:
        return "";
    }
  }

  private getFallbackResponse(state: BotState, error?: string): string {
    const baseResponse = "Уучлаарай, би таны хүсэлтийг ойлгосонгүй. ";

    if (error) {
      return baseResponse + error;
    }

    switch (state) {
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return baseResponse + "Аялал сонгохын тулд дээрх жагсаалтаас тоо оруулна уу.";
      case BotState.WAITING_FOR_DATE:
        return baseResponse + "Огноо оруулахын тулд YYYY-MM-DD форматаар бичнэ үү.";
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return baseResponse + "Хүний тоо оруулна уу.";
      default:
        return baseResponse + "Дахин оролдоно уу.";
    }
  }

  private getSuggestedActions(state: BotState, context: ChatContext): string[] {
    switch (state) {
      case BotState.IDLE:
        return [
          "Аялын талаар асуулт асуух",
          "Хамгийн хямд аялал хайх",
          "'Захиалах' гэж бичиж захиалга эхлүүлэх",
        ];
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return [
          "Аялын дэлгэрэнгүй мэдээлэл асуух",
          "Тоо оруулж сонгох",
        ];
      case BotState.WAITING_FOR_DATE:
        return [
          "Аялалын талаар асуух",
          "Огноо оруулах",
        ];
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return [
          "Аялалын талаар асуух",
          "Хүний тоо оруулах",
        ];
      case BotState.BOOKING_CONFIRMED:
        return [
          "Төлбөрийн талаар асуух",
          "Шинэ захиалга эхлүүлэх",
        ];
      default:
        return [];
    }
  }

  private getBookingProgress(context: ChatContext): string {
    const progress: string[] = [];

    if (context.selectedTour) {
      progress.push("✅ Аялал сонгосон");
    } else {
      progress.push("⬜ Аялал сонгох");
    }

    if (context.departureDate) {
      progress.push("✅ Огноо сонгосон");
    } else if (context.state >= BotState.WAITING_FOR_DATE) {
      progress.push("⬜ Огноо сонгох");
    }

    if (context.numberOfTravelers) {
      progress.push("✅ Хүний тоо сонгосон");
    } else if (context.state >= BotState.WAITING_FOR_NUM_TRAVELERS) {
      progress.push("⬜ Хүний тоо сонгох");
    }

    return progress.join("\n");
  }
}

export const enhancedFsmService = new EnhancedFSMService();