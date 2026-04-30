export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  markdown?: boolean;
  errored?: boolean;
  streaming?: boolean;
  tours?: TourResult[];
  messageType?: 'tour_results' | 'conversation';
  isAIGenerative?: boolean;
  intentType?: 'cheapest' | 'recommend' | 'best' | 'general';
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

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatContext {
  conversationHistory?: string[];
  userPreferences?: Record<string, unknown>;
  locale?: 'en' | 'mn';
  toursContext?: string;
}

export interface ChatApiResponse {
  reply: string;
  tours?: TourResult[];
  type?: 'tour_results' | 'conversation';
  suggestions?: string[];
  isAIGenerative?: boolean;
  intentType?: 'cheapest' | 'recommend' | 'best' | 'general';
}

export interface TourResult {
  id: string;
  title: string;
  destination: string;
  base_price: number;
  departure_date: string;
  duration_day: number;
  seats: number;
}

export interface ChatErrorState {
  message: string;
  code?: string;
  retryable: boolean;
}

export interface QuickSuggestion {
  id: string;
  text: string;
  textEn: string;
  textMn: string;
}

export const DEFAULT_QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { id: '1', text: 'Find trips under $500', textEn: 'Find trips under $500', textMn: '$500-аас доош аялал хайх' },
  { id: '2', text: 'Best destinations', textEn: 'Best destinations', textMn: 'Шилдэг чиглэлүүд' },
  { id: '3', text: 'Help me plan a trip', textEn: 'Help me plan a trip', textMn: 'Миний аялал төлөвлөхөд туслах' },
  { id: '4', text: 'Seasonal deals', textEn: 'Seasonal deals', textMn: 'Улиалтын хямдрал' },
];

export type ChatWidgetState = 'minimized' | 'expanded';