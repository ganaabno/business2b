/**
 * AI Context Manager for Hybrid Chatbot
 *
 * This module keeps the AI aware of conversation state and booking context,
 * enabling state-aware responses that maintain context during the booking flow.
 */

import { BotState, ChatContext } from "./fsm.service.js";
import { TourForAI } from "../../integrations/groq/groq.client.js";

export interface AIContext {
  systemPrompt: string;
  conversationContext: string;
  bookingContext: string;
  stateAwareInstructions: string;
  fullPrompt: string;
}

export interface StateAwarePrompt {
  currentState: BotState;
  userQuestion: string;
  bookingProgress: string;
  helpfulReminder: string;
  suggestedActions: string[];
}

/**
 * Build comprehensive AI context that includes conversation state
 */
export function buildAIContext(
  context: ChatContext,
  userMessage: string,
  conversationHistory?: string[],
): AIContext {
  const systemPrompt = buildSystemPrompt();
  const conversationContext = buildConversationContext(conversationHistory);
  const bookingContext = formatBookingDataForAI(context);
  const stateAwareInstructions = buildStateAwarePrompt(
    context.state,
    userMessage,
    context,
  );
  const fullPrompt = combinePrompts(
    systemPrompt,
    conversationContext,
    bookingContext,
    stateAwareInstructions,
  );

  return {
    systemPrompt,
    conversationContext,
    bookingContext,
    stateAwareInstructions,
    fullPrompt,
  };
}

/**
 * Build the base system prompt for AI
 */
function buildSystemPrompt(): string {
  return `Та нь GTrip аялалын AI зөвлөх.

🎯 Таны зорилго:
- Хэрэглэгчид хамгийн тохирох аяллыг ОЛЖ ӨГӨХ
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
- title, destination, base_price, duration_day, departure_date, seats

🚫 ХОРИГЛОХ:
- Хоосон ерөнхий яриа
- "Мэдэхгүй" гэж шууд хэлэх
- Урт нуршсан текст

✅ ҮР ДҮН:
- Markdown ашигла
- Жагсаалт ашигла
- Үнэ + огноо заавал бич`;
}

/**
 * Build conversation context from history
 */
function buildConversationContext(conversationHistory?: string[]): string {
  if (!conversationHistory || conversationHistory.length === 0) {
    return "";
  }

  const recentHistory = conversationHistory.slice(-5).join("\n");
  return `
ӨМНӨХ ХАРИЛЦАА:
${recentHistory}
`;
}

/**
 * Format booking data for AI understanding
 */
function formatBookingDataForAI(context: ChatContext): string {
  const parts: string[] = [];

  if (context.selectedTour) {
    const tour = context.selectedTour;
    parts.push(`
🎯 СОНГСОН АЯЛ:
- Нэр: ${tour.title}
- Үнэ: ${(tour.base_price || 0).toLocaleString()}₮
- Хоног: ${tour.duration_day || "Тодорхойгүй"} хоног
- Огноо: ${tour.departure_date || tour.departure_date || "Тодорхойгүй"}
- Суудал: ${tour.seats} суудал
`);
  }

  if (context.departureDate) {
    parts.push(`
📅 ОГНОО: ${context.departureDate}
`);
  }

  if (context.numberOfTravelers) {
    parts.push(`
👥 ХҮНИЙ ТОО: ${context.numberOfTravelers} хүн
`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `
ЗАХИАЛГИЙН МЭДЭЭЛЭЛ:
${parts.join("\n")}
`;
}

/**
 * Build state-aware prompt with helpful instructions
 */
function buildStateAwarePrompt(
  currentState: BotState,
  userMessage: string,
  context: ChatContext,
): string {
  const stateInfo = getStateInformation(currentState, context);
  const bookingProgress = getBookingProgress(currentState, context);
  const helpfulReminder = getHelpfulReminder(currentState, context);
  const suggestedActions = getSuggestedActions(currentState, context);

  return `
🔄 ОДООГИЙН ТӨЛӨВ: ${currentState}

${stateInfo}

${bookingProgress}

${helpfulReminder}

${suggestedActions.length > 0 ? `💡 ЗӨВЛӨМЖ:\n${suggestedActions.map((a) => `- ${a}`).join("\n")}` : ""}
`;
}

/**
 * Get information about current state
 */
function getStateInformation(
  currentState: BotState,
  context: ChatContext,
): string {
  switch (currentState) {
    case BotState.IDLE:
      return "Хэрэглэгч захиалга эхлээгүй байна. Тухайн байгаа аялуудын талаар асууж болно.";

    case BotState.WAITING_FOR_TOUR_SELECTION:
      return "Хэрэглэгч аялал сонгохыг хүсч байна.";

    case BotState.WAITING_FOR_DATE:
      return `Хэрэглэгч "${context.selectedTour?.title || "сонгосон аялал"}"-ын огноо сонгохыг хүсч байна.`;

    case BotState.WAITING_FOR_NUM_TRAVELERS:
      return `Хэрэглэгч "${context.selectedTour?.title || "сонгосон аялал"}"-д хэдэн хүн явахаа сонгохыг хүсч байна.`;

    case BotState.BOOKING_CONFIRMED:
      return "Захиалга баталгаажсан байна.";

    default:
      return "Төлөв тодорхойгүй байна.";
  }
}

/**
 * Get booking progress description
 */
function getBookingProgress(
  currentState: BotState,
  context: ChatContext,
): string {
  const progress: string[] = [];

  if (context.selectedTour) {
    progress.push("✅ Аялал сонгосон");
  } else {
    progress.push("⬜ Аялал сонгох");
  }

  if (context.departureDate) {
    progress.push("✅ Огноо сонгосон");
  } else if (currentState >= BotState.WAITING_FOR_DATE) {
    progress.push("⬜ Огноо сонгох");
  }

  if (context.numberOfTravelers) {
    progress.push("✅ Хүний тоо сонгосон");
  } else if (currentState >= BotState.WAITING_FOR_NUM_TRAVELERS) {
    progress.push("⬜ Хүний тоо сонгох");
  }

  return `
📈 ЗАХИАЛГИЙН ДАВТАР:
${progress.join("\n")}
`;
}

/**
 * Get helpful reminder based on state
 */
function getHelpfulReminder(
  currentState: BotState,
  context: ChatContext,
): string {
  switch (currentState) {
    case BotState.IDLE:
      return "💬 Хэрэглэгч ямар ч асуулт асууж болно. Хэрэв захиалга эхлүүлбэл 'захиалах' гэж хэлнэ үү.";

    case BotState.WAITING_FOR_TOUR_SELECTION:
      return "💬 Хэрэглэгч аялын талаар асууж болно. Хэрэв сонгосон бол '1', '2' гэх мэт тоо оруулна.";

    case BotState.WAITING_FOR_DATE:
      return "💬 Хэрэглэгч аялалын талаар асууж болно. Огноо оруулбал '2026-06-01' маягийгаар бичнэ үү.";

    case BotState.WAITING_FOR_NUM_TRAVELERS:
      return "💬 Хэрэглэгч аялалын талаар асууж болно. Хүний тоо оруулбал зөвхөн тоо бичнэ үү.";

    case BotState.BOOKING_CONFIRMED:
      return "💬 Захиалга баталгаажсан. Хэрэглэгч өөр асуулт асууж болно.";

    default:
      return "💬 Хэрэглэгчид тусална уу.";
  }
}

/**
 * Get suggested actions based on state
 */
function getSuggestedActions(
  currentState: BotState,
  context: ChatContext,
): string[] {
  switch (currentState) {
    case BotState.IDLE:
      return [
        "Аялын талаар асуулт асуух",
        "Хамгийн хямд аялал хайх",
        "Зөвлөхөөс санал авах",
        "'Захиалах' гэж бичиж захиалга эхлүүлэх",
      ];

    case BotState.WAITING_FOR_TOUR_SELECTION:
      return [
        "Аялын дэлгэрэнгүй мэдээлэл асуух",
        "Үнийн талаар асуух",
        "Өөр аялал харах",
        "Тоо оруулж сонгох",
      ];

    case BotState.WAITING_FOR_DATE:
      return [
        "Аялалын хөтөлбөр асуух",
        "Аялалын онцлог асуух",
        "Огноо оруулах",
      ];

    case BotState.WAITING_FOR_NUM_TRAVELERS:
      return [
        "Группийн хөнгөлөлт тухай асуух",
        "Хүүхдийн үнэ тухай асуух",
        "Хүний тоо оруулах",
      ];

    case BotState.BOOKING_CONFIRMED:
      return [
        "Төлбөрийн талаар асуух",
        "Бусад аялал харах",
        "Шинэ захиалга эхлүүлэх",
      ];

    default:
      return [];
  }
}

/**
 * Combine all prompts into one comprehensive prompt
 */
function combinePrompts(
  systemPrompt: string,
  conversationContext: string,
  bookingContext: string,
  stateAwareInstructions: string,
): string {
  return `${systemPrompt}

${conversationContext}

${bookingContext}

${stateAwareInstructions}

📝 ХАРИУЛДАХ ДААРАЬ:
1. Хэрэглэгчийн асуултыг ойлгож хариулна уу
2. Одоогийн төлөвийг харгалзан үзнэ үү
3. Туслах зөвлөмж өгнө үү
4. Хэрэв дутагдаж буй мэдээлэл байвал асуулт асууна уу
5. Товч, тодорхой, эерэг байх`;
}

/**
 * Generate state-aware prompt for specific user question
 */
export function generateStateAwarePrompt(
  currentState: BotState,
  userQuestion: string,
  context: ChatContext,
): StateAwarePrompt {
  return {
    currentState,
    userQuestion,
    bookingProgress: getBookingProgress(currentState, context),
    helpfulReminder: getHelpfulReminder(currentState, context),
    suggestedActions: getSuggestedActions(currentState, context),
  };
}

/**
 * Format tours for AI context
 */
export function formatToursForAIContext(tours: TourForAI[]): string {
  if (tours.length === 0) {
    return "Идэвхтэй аял олдсонгүй.";
  }

  return tours
    .map(
      (t, i) => {
        const departureDate = t.departure_date || t.departure_date;
        const duration = t.duration_day ? `${t.duration_day} хоног` : "Тодорхойгүй";
        return `
[${i + 1}]
Нэр: ${t.title}
Үнэ: ${(t.base_price || 0).toLocaleString()}₮
Хоног: ${duration}
Огноо: ${departureDate || "Тодорхойгүй"}
Суудал: ${t.seats}
`;
      },
    )
    .join("\n");
}

/**
 * Build AI prompt for tour recommendations
 */
export function buildTourRecommendationPrompt(
  userMessage: string,
  tours: TourForAI[],
  intentContext: string,
): string {
  const toursList = formatToursForAIContext(tours);

  return `Та нь GTrip аялалын зөвлөх AI. Хэрэглэгчээс аялалын талаар асуусан бөгөөд тэдгээрийн хүсэлтэд тохирсон аялуудыг санал болгох болно.

ЧУХАЛ ЗААВАР:
1. Хэрэглэгчийн асуусан аялын хүсэлтэнд тохирсон аялуудыг ДООРХ ЖАГСААЛТААС сонгоно уу
2. Хэрэглэгчид өөрийн үгээр, байгалийн хэлээр хариулах
3. Тус бүрийн давуу талыг товч тайлбарлах
4. Үнэ, огноо, хоног, суудал тоог заавал бичих
5. Markdown ашиглан сайтар бүтүүлээрэй

АЯЛУУДЫН ЖАГСААЛТ:
${toursList}

${intentContext}

Хэрэглэгчийн асуусан аял: ${userMessage}

Хариулахдаа:
- Эхлээд хэрэглэгчийн хүсэлтийг тусгайлан тайлбарласнаа бич
- Сонгосон аялуудыг жагсааж, тус бүрийн онцлогийг бич
- "Сонгох" эсвэл "Захиалах" болон товч үнийг заавал бич
- 2-3 аялал санал болговол хүрэлцээтэй`;
}
