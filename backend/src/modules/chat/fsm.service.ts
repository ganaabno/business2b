import { TourForAI } from "../../integrations/groq/groq.client.js";

export enum BotState {
  IDLE = "IDLE",
  WAITING_FOR_TOUR_SELECTION = "WAITING_FOR_TOUR_SELECTION",
  WAITING_FOR_DATE = "WAITING_FOR_DATE",
  WAITING_FOR_NUM_TRAVELERS = "WAITING_FOR_NUM_TRAVELERS",
  BOOKING_CONFIRMED = "BOOKING_CONFIRMED",
}

export interface ChatContext {
  state: BotState;
  selectedTourId?: string;
  selectedTour?: TourForAI;
  departureDate?: string;
  numberOfTravelers?: number;
  // Add other booking details as needed
}

export interface FSMResponse {
  reply: string;
  newState: BotState;
  isFSMTriggered: boolean;
  data?: object;
}

export class FSMService {
  private tours: TourForAI[] = []; // In a real app, this would be fetched dynamically

  setTours(tours: TourForAI[]) {
    this.tours = tours;
  }

  processMessage(message: string, context: ChatContext): FSMResponse {
    switch (context.state) {
      case BotState.IDLE:
        return this.handleIdleState(message, context);
      case BotState.WAITING_FOR_TOUR_SELECTION:
        return this.handleTourSelection(message, context);
      case BotState.WAITING_FOR_DATE:
        return this.handleDateSelection(message, context);
      case BotState.WAITING_FOR_NUM_TRAVELERS:
        return this.handleTravelersSelection(message, context);
      case BotState.BOOKING_CONFIRMED:
        return {
          reply: "Таны захиалга баталгаажсан. Та өөр асуух зүйл байна уу?",
          newState: BotState.IDLE, // Reset after confirmation or offer more options
          isFSMTriggered: true,
        };
      default:
        return {
          reply: "Уучлаарай, би таны хүсэлтийг ойлгосонгүй.",
          newState: BotState.IDLE,
          isFSMTriggered: false,
        };
    }
  }

  private handleIdleState(
    message: string,
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */ context: ChatContext,
  ): FSMResponse {
    const lowerMsg = message.toLowerCase();

    // Check for explicit FSM initiation keywords, e.g., "захиалах", "номлох", "аялал сонгох"
    if (
      lowerMsg.includes("захиалах") ||
      lowerMsg.includes("номлох") ||
      lowerMsg.includes("аялал сонгох") ||
      lowerMsg.includes("booking") ||
      lowerMsg.includes("reserve")
    ) {
      return {
        reply: "Та аялалаа сонгоно уу. (Жишээ: 1)",
        newState: BotState.WAITING_FOR_TOUR_SELECTION,
        isFSMTriggered: true,
      };
    }
    // If not an FSM initiation, let AI handle it
    return {
      reply: "", // AI will fill this
      newState: BotState.IDLE,
      isFSMTriggered: false,
    };
  }

  private handleTourSelection(
    message: string,
    context: ChatContext,
  ): FSMResponse {
    const tourIndex = parseInt(message.trim());

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

  private handleDateSelection(
    message: string,
    context: ChatContext,
  ): FSMResponse {
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (!dateRegex.test(message)) {
      return {
        reply: "Буруу огноо байна. Та YYYY-MM-DD форматаар оруулна уу.",
        newState: BotState.WAITING_FOR_DATE,
        isFSMTriggered: true,
      };
    }

    const [year, month, day] = message.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (isNaN(date.getTime())) {
      return {
        reply: "Буруу огноо байна. Та YYYY-MM-DD форматаар оруулна уу.",
        newState: BotState.WAITING_FOR_DATE,
        isFSMTriggered: true,
      };
    }

    context.departureDate = message;

    return {
      reply: `Та ${message} огноог сонголоо. Хэдэн хүн явах вэ?`,
      newState: BotState.WAITING_FOR_NUM_TRAVELERS,
      isFSMTriggered: true,
      data: { departureDate: message },
    };
  }

  private handleTravelersSelection(
    message: string,
    context: ChatContext,
  ): FSMResponse {
    const numTravelers = parseInt(message.trim());

    if (isNaN(numTravelers) || numTravelers < 1) {
      return {
        reply: "Хүний тоо буруу байна. Та эерэг тоо оруулна уу.",
        newState: BotState.WAITING_FOR_NUM_TRAVELERS,
        isFSMTriggered: true,
      };
    }

    // Check against available seats if selectedTour is available and has seats property
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

    // Here you would typically save the booking details or confirm with the user
    return {
      reply: `Та ${context.selectedTour?.title} аялалд ${context.departureDate} өдөр ${numTravelers} хүнтэй явах захиалга хийлээ.`,
      newState: BotState.BOOKING_CONFIRMED,
      isFSMTriggered: true,
      data: { numberOfTravelers: numTravelers },
    };
  }
}

export const fsmService = new FSMService();
