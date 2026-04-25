import { supabase } from "../supabaseClient";
import type {
  PriceConfig,
  Conversation,
  ChatMessage,
  CarType,
  ItineraryItem,
  SeasonalPricing,
} from "../types/chat";

export async function fetchPriceConfigs(): Promise<PriceConfig[]> {
  const { data, error } = await supabase
    .from("travel_price_config")
    .select("*")
    .eq("is_active", true)
    .order("destination");

  if (error) throw error;
  return data || [];
}

export async function updatePriceConfig(
  id: string,
  updates: Partial<PriceConfig>,
): Promise<void> {
  const { error } = await supabase
    .from("travel_price_config")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function createPriceConfig(
  config: Omit<PriceConfig, "id" | "created_at" | "updated_at">,
): Promise<PriceConfig> {
  const { data, error } = await supabase
    .from("travel_price_config")
    .insert(config)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePriceConfig(id: string): Promise<void> {
  const { error } = await supabase
    .from("travel_price_config")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Car Types API
export async function fetchCarTypes(): Promise<CarType[]> {
  const { data, error } = await supabase
    .from("car_types")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function createCarType(
  car: Omit<CarType, "id" | "created_at" | "updated_at">,
): Promise<CarType> {
  const { data, error } = await supabase
    .from("car_types")
    .insert(car)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCarType(
  id: string,
  updates: Partial<CarType>,
): Promise<void> {
  const { error } = await supabase
    .from("car_types")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteCarType(id: string): Promise<void> {
  const { error } = await supabase.from("car_types").delete().eq("id", id);

  if (error) throw error;
}

// Itinerary Items API
export async function fetchItineraryItems(): Promise<ItineraryItem[]> {
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw error;
  return data || [];
}

export async function createItineraryItem(
  item: Omit<ItineraryItem, "id" | "created_at" | "updated_at">,
): Promise<ItineraryItem> {
  const { data, error } = await supabase
    .from("itinerary_items")
    .insert(item)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateItineraryItem(
  id: string,
  updates: Partial<ItineraryItem>,
): Promise<void> {
  const { error } = await supabase
    .from("itinerary_items")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteItineraryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Seasonal Pricing API
export async function fetchSeasonalPricing(
  destination?: string,
): Promise<SeasonalPricing[]> {
  let query = supabase
    .from("seasonal_pricing")
    .select("*")
    .eq("is_active", true)
    .order("start_date");

  if (destination) {
    query = query.eq("destination", destination);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function createSeasonalPricing(
  pricing: Omit<SeasonalPricing, "id" | "created_at">,
): Promise<SeasonalPricing> {
  const { data, error } = await supabase
    .from("seasonal_pricing")
    .insert(pricing)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSeasonalPricing(
  id: string,
  updates: Partial<SeasonalPricing>,
): Promise<void> {
  const { error } = await supabase
    .from("seasonal_pricing")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteSeasonalPricing(id: string): Promise<void> {
  const { error } = await supabase
    .from("seasonal_pricing")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getSeasonalMultiplier(
  destination: string,
  date: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("seasonal_pricing")
    .select("multiplier")
    .eq("destination", destination)
    .eq("is_active", true)
    .lte("start_date", date)
    .gte("end_date", date)
    .single();

  if (error || !data) return 1.0;
  return data.multiplier;
}

export async function getOrCreateConversation(
  participantBId: string,
): Promise<Conversation> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("*")
    .or(
      `and(participant_a_id.eq.${user.id},participant_b_id.eq.${participantBId}),and(participant_a_id.eq.${participantBId},participant_b_id.eq.${user.id})`,
    )
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({
      participant_a_id: user.id,
      participant_b_id: participantBId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function sendMessage(
  conversationId: string,
  content: string,
  messageType: "text" | "price_quote" = "text",
): Promise<ChatMessage> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: messageType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function markMessageAsRead(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId);

  if (error) throw error;
}

export async function fetchUnreadCount(
  conversationId: string,
): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  if (error) return 0;
  return count || 0;
}

export async function fetchAllConversations(): Promise<Conversation[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("*")
    .or(`participant_a_id.eq.${user.id},participant_b_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getConversationPartner(
  conversation: Conversation,
): Promise<{ id: string; email: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const partnerId =
    conversation.participant_a_id === user.id
      ? conversation.participant_b_id
      : conversation.participant_a_id;

  const { data, error } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", partnerId)
    .single();

  if (error) return null;
  return data;
}

export async function createPriceQuote(quote: {
  conversation_id?: string;
  destination: string;
  start_date: string;
  end_date: string;
  days: number;
  people: number;
  hotel_type?: string;
  flight_class?: string;
  total_price: number;
  breakdown: any[];
}): Promise<any> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: result, error } = await supabase
    .from("price_quotes")
    .insert({
      conversation_id: quote.conversation_id,
      creator_id: user.id,
      destination: quote.destination,
      start_date: quote.start_date,
      end_date: quote.end_date,
      days: quote.days,
      people: quote.people,
      hotel_type: quote.hotel_type,
      flight_class: quote.flight_class,
      total_price: quote.total_price,
      breakdown: quote.breakdown,
      status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return result;
}

export async function fetchPriceQuotes(
  conversationId?: string,
): Promise<any[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("price_quotes")
    .select("*")
    .order("created_at", { ascending: false });

  if (conversationId) {
    query = query.eq("conversation_id", conversationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function updateQuoteStatus(
  quoteId: string,
  status: string,
  bookingId?: string,
): Promise<void> {
  const update: any = { status, updated_at: new Date().toISOString() };
  if (bookingId) update.booking_id = bookingId;

  const { error } = await supabase
    .from("price_quotes")
    .update(update)
    .eq("id", quoteId);

  if (error) throw error;
}

export async function deletePriceQuote(quoteId: string): Promise<void> {
  const { error } = await supabase
    .from("price_quotes")
    .delete()
    .eq("id", quoteId);

  if (error) throw error;
}

export async function convertQuoteToBooking(
  quoteId: string,
  tourId: string,
  departureDate: string,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: quote, error: quoteError } = await supabase
    .from("price_quotes")
    .select("*")
    .eq("id", quoteId)
    .single();

  if (quoteError || !quote) throw new Error("Quote not found");

  const { data: order, error: orderError } = await supabase.rpc(
    "book_trip_shared",
    {
      p_user_id: user.id,
      p_tour_id: tourId,
      p_tour_title: quote.destination,
      p_departure_date: departureDate,
      p_payment_method: "qpay",
      p_order_status: "pending",
      p_order_source: "chatbot",
      p_source_order_id: `quote-${quoteId}`,
      p_passengers: JSON.stringify(
        Array(quote.people)
          .fill(null)
          .map((_, i) => ({
            name: `Passenger ${i + 1}`,
            first_name: `Passenger`,
            last_name: `${i + 1}`,
            price: Math.floor(quote.total_price / quote.people),
            seat_count: 1,
          })),
      ),
    },
  );

  if (orderError) throw orderError;

  await updateQuoteStatus(quoteId, "converted", order?.order_id);

  return order?.order_id;
}

export async function createChatSession(userId: string): Promise<any> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userId,
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getChatSessions(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateChatSession(
  sessionId: string,
  updates: { context?: any; selected_tour_id?: string; status?: string },
): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function endChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({
      status: "completed",
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}

export async function fetchToursForChat(): Promise<any[]> {
  // Only use columns that actually exist in the tours table
  const { data, error } = await supabase
    .from("tours")
    .select(
      "id, title, name, tour_type, description, dates, departure_date, seats, base_price, status, hotels, image_key, duration_day, airlines, cities, services",
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[API] fetchToursForChat error:", error.message);
    throw error;
  }

  // Filter out tours with 0 seats client-side (if available_seats doesn't work on server)
  const toursWithSeats = (data || []).filter((t) => (t.seats || 0) > 0);
  console.log(
    "[API] fetchToursForChat: Found",
    toursWithSeats.length,
    "active tours",
  );
  return toursWithSeats;
}

export async function fetchTourDates(tourId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tour_dates")
    .select("*")
    .eq("tour_id", tourId)
    .eq("is_active", true)
    .order("departure_date");

  if (error) throw error;
  return data || [];
}

export async function fetchTourItineraries(tourId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tour_itineraries")
    .select("*")
    .eq("tour_id", tourId)
    .eq("is_active", true)
    .order("display_order");

  if (error) throw error;
  return data || [];
}

export async function fetchTourFlights(tourId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tour_flights")
    .select("*")
    .eq("tour_id", tourId)
    .eq("is_active", true)
    .order("price_modifier");

  if (error) throw error;
  return data || [];
}

export async function fetchTourHotels(tourId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("tour_hotels")
    .select("*")
    .eq("tour_id", tourId)
    .eq("is_active", true)
    .order("price_per_night");

  if (error) throw error;
  return data || [];
}

export async function createTourDate(dateData: {
  tour_id: string;
  departure_date: string;
  return_date?: string;
  available_seats?: number;
  price_modifier?: number;
}): Promise<any> {
  const { data, error } = await supabase
    .from("tour_dates")
    .insert(dateData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTourDate(id: string, updates: any): Promise<void> {
  const { error } = await supabase
    .from("tour_dates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteTourDate(id: string): Promise<void> {
  const { error } = await supabase.from("tour_dates").delete().eq("id", id);

  if (error) throw error;
}

export async function createTourItinerary(itineraryData: {
  tour_id: string;
  name: string;
  name_en?: string;
  duration_days?: number;
  duration_nights?: number;
  highlights?: string[];
  price_modifier?: number;
  description?: string;
  is_active?: boolean;
}): Promise<any> {
  const { data, error } = await supabase
    .from("tour_itineraries")
    .insert(itineraryData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTourItinerary(
  id: string,
  updates: any,
): Promise<void> {
  const { error } = await supabase
    .from("tour_itineraries")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteTourItinerary(id: string): Promise<void> {
  const { error } = await supabase
    .from("tour_itineraries")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function createTourFlight(flightData: {
  tour_id: string;
  airline: string;
  departure_time?: string;
  arrival_time?: string;
  price_modifier?: number;
  flight_class?: string;
}): Promise<any> {
  const { data, error } = await supabase
    .from("tour_flights")
    .insert(flightData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTourFlight(
  id: string,
  updates: any,
): Promise<void> {
  const { error } = await supabase
    .from("tour_flights")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteTourFlight(id: string): Promise<void> {
  const { error } = await supabase.from("tour_flights").delete().eq("id", id);

  if (error) throw error;
}

export async function createTourHotel(hotelData: {
  tour_id: string;
  name: string;
  star_rating: number;
  price_per_night?: number;
  description?: string;
  image_url?: string;
}): Promise<any> {
  const { data, error } = await supabase
    .from("tour_hotels")
    .insert(hotelData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTourHotel(id: string, updates: any): Promise<void> {
  const { error } = await supabase
    .from("tour_hotels")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}

export async function deleteTourHotel(id: string): Promise<void> {
  const { error } = await supabase.from("tour_hotels").delete().eq("id", id);

  if (error) throw error;
}

export interface ChatSessionMessage {
  id: string;
  session_id: string;
  role: "user" | "bot";
  content: string;
  state?: string;
  conversation_data?: any;
  price_result?: any;
  created_at: string;
}

export interface ChatSessionWithMessages {
  id: string;
  user_id: string;
  context: Record<string, unknown>;
  selected_tour_id: string | null;
  title: string | null;
  summary: string | null;
  started_at: string;
  ended_at: string | null;
  status: "active" | "completed" | "abandoned";
  created_at: string;
  updated_at: string;
  messages?: ChatSessionMessage[];
}

export async function saveSessionMessage(
  sessionId: string,
  message: {
    role: "user" | "bot";
    content: string;
    state?: string;
    conversation_data?: any;
    price_result?: any;
  },
): Promise<ChatSessionMessage> {
  const { data, error } = await supabase
    .from("chat_session_messages")
    .insert({
      session_id: sessionId,
      ...message,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSessionMessages(
  sessionId: string,
): Promise<ChatSessionMessage[]> {
  const { data, error } = await supabase
    .from("chat_session_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getChatSessionsWithMessages(
  userId: string,
): Promise<ChatSessionWithMessages[]> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) throw error;
}

export async function updateChatSessionTitle(
  sessionId: string,
  title: string,
  summary?: string,
): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({
      title,
      summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;
}
