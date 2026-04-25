export interface PriceConfig {
  id: string;
  destination: string;
  flight_price_per_person: number;
  hotel_3star_price_per_night: number;
  hotel_4star_price_per_night: number;
  hotel_5star_price_per_night: number;
  guide_price_per_day: number;
  insurance_price_per_person: number;
  transport_price_per_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'price_quote';
  is_ai?: boolean;
  created_at: string;
  read_at: string | null;
}

export interface ChatSession {
  id: string;
  user_id: string;
  context: Record<string, unknown>;
  selected_tour_id: string | null;
  title?: string | null;
  summary?: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
}

export interface ChatSessionMessage {
  id: string;
  session_id: string;
  role: 'user' | 'bot';
  content: string;
  state?: string;
  conversation_data?: Record<string, unknown>;
  price_result?: {
    total: number;
    breakdown: PriceBreakdownItem[];
  };
  created_at: string;
}

export interface ChatSessionWithMessages extends ChatSession {
  messages?: ChatSessionMessage[];
}

export interface TourInChat {
  id: string;
  title: string;
  name?: string;
  destination?: string | null;
  dates: string[];
  departure_date?: string;
  seats: number;
  available_seats?: number;
  price_base?: number;
  base_price?: number;
  status?: string;
  hotels?: string | null;
  image_key?: string | null;
  duration_day?: string | null;
}

export interface CalculatorInput {
  destination: string;
  people: number;
  days: number;
  hotelType: '3star' | '4star' | '5star';
  hasGuide: boolean;
  hasInsurance: boolean;
  hasTransport: boolean;
}

export interface PriceBreakdownItem {
  item: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PriceResult {
  total: number;
  breakdown: PriceBreakdownItem[];
}

// New types for conversational chatbot
export interface CarType {
  id: string;
  name: string;
  description: string | null;
  price_per_day: number;
  capacity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItineraryItem {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price_model: 'per_day' | 'per_person' | 'fixed';
  price_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SeasonalPricing {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  multiplier: number;
  is_active: boolean;
  created_at: string;
}

// Conversational chat state types
export type ChatState = 
  | 'greeting'
  | 'tour_selection'
  | 'date_selection'
  | 'travelers'
  | 'itinerary_selection'
  | 'flight_selection'
  | 'transport_selection'
  | 'hotel_selection'
  | 'summary'
  | 'calculating'
  | 'result'
  // Legacy states for backward compatibility
  | 'destination'
  | 'dates'
  | 'people'
  | 'flight'
  | 'hotel'
  | 'itinerary'
  | 'car';

export interface ConversationData {
  destination: string;
  startDate: string;
  endDate: string;
  people: number;
  hotelType: '3star' | '4star' | '5star';
  itineraryItems: string[];
  carType: string;
}

export interface ChatQuestion {
  state: ChatState;
  question: string;
  options?: string[];
  placeholder?: string;
}

export interface Destination {
  id: string;
  name: string;
  name_en: string | null;
  country: string | null;
  country_code: string | null;
  is_active: boolean;
  display_order: number;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlightClass {
  id: string;
  name: string;
  name_en: string | null;
  multiplier: number;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface VisaFee {
  id: string;
  destination: string;
  country: string | null;
  country_code: string | null;
  price_mnt: number;
  requirements: string | null;
  processing_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OptionalActivity {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price_model: 'per_day' | 'per_person' | 'fixed';
  price_value: number;
  destination: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PriceQuote {
  id: string;
  conversation_id: string | null;
  creator_id: string | null;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  people: number | null;
  hotel_type: '3star' | '4star' | '5star' | null;
  flight_class: 'economy' | 'business' | 'first' | null;
  hotel_price_per_night: number | null;
  flight_price_per_person: number | null;
  visa_price: number;
  visa_included: boolean;
  activities: ActivitySelection[];
  car_type: string | null;
  car_price_per_day: number | null;
  guide_price_per_day: number | null;
  insurance_price_per_person: number | null;
  subtotal: number;
  seasonal_multiplier: number;
  total_price: number;
  breakdown: PriceBreakdownItem[];
  status: 'pending' | 'converted' | 'expired';
  booking_id: string | null;
  qpay_invoice_id: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivitySelection {
  id: string;
  name: string;
  price_value: number;
  quantity: number;
  total: number;
}

export interface QuoteAnalytics {
  id: string;
  quote_id: string;
  visitor_id: string | null;
  event_type: 'view' | 'convert' | 'share' | 'expire';
  event_data: Record<string, unknown>;
  created_at: string;
}

// Tour-related types for chatbot flow
export interface TourForChat {
  id: string;
  title: string;
  name: string;
  destination: string | null;
  tour_type: 'outbound' | 'inbound';
  description: string | null;
  dates: string[];
  departure_date: string | null;
  seats: number;
  available_seats: number;
  price_base: number | null;
  base_price: number;
  status: string;
  hotels: string | string[] | null;
  image_key: string | null;
  duration_day: string | null;
}

export interface TourDate {
  id: string;
  tour_id: string;
  departure_date: string;
  return_date: string | null;
  available_seats: number;
  is_active: boolean;
  price_modifier: number;
  created_at: string;
}

export interface TourItinerary {
  id: string;
  tour_id: string;
  name: string;
  name_en: string | null;
  duration_days: number | null;
  duration_nights: number | null;
  highlights: string[] | null;
  price_modifier: number;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface TourFlight {
  id: string;
  tour_id: string;
  airline: string;
  departure_time: string | null;
  arrival_time: string | null;
  price_modifier: number;
  flight_class: 'economy' | 'business' | 'first';
  is_active: boolean;
  created_at: string;
}

export interface TourHotel {
  id: string;
  tour_id: string;
  name: string;
  star_rating: number;
  price_per_night: number | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

// Chatbot conversation flow types
export type ChatFlowState = 
  | 'greeting'
  | 'tour_selection'
  | 'date_selection'
  | 'travelers'
  | 'itinerary_selection'
  | 'flight_selection'
  | 'transport_selection'
  | 'hotel_selection'
  | 'summary'
  | 'calculating'
  | 'result';

export interface ChatbotSelection {
  tour: TourForChat | null;
  tourDate: TourDate | null;
  travelers: number;
  itinerary: TourItinerary | null;
  flight: TourFlight | null;
  transport: string | null;
  hotel: TourHotel | null;
}
