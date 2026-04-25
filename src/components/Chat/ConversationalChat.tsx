import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  RefreshCw,
  Check,
  Calculator,
  Plane,
  Zap,
  MapPin,
  Calendar,
  Users,
  Building,
  History,
  Trash2,
  Edit3,
  X,
  Clock,
  ChevronRight,
  Car,
  Hotel,
  Sun,
  Moon,
} from "lucide-react";
import type {
  ChatState,
  ConversationData,
  CarType,
  ItineraryItem,
  PriceBreakdownItem,
  FlightClass,
  Destination,
  TourInChat,
  ChatSession,
  ChatSessionMessage,
  TourForChat,
  TourDate as ChatTourDate,
  TourItinerary,
  TourFlight,
  TourHotel,
} from "../../types/chat";
import {
  fetchPriceConfigs,
  fetchCarTypes,
  fetchItineraryItems,
  getSeasonalMultiplier,
  createChatSession,
  updateChatSession,
  endChatSession,
  fetchToursForChat,
  createPriceQuote,
  saveSessionMessage,
  fetchSessionMessages,
  getChatSessionsWithMessages,
  deleteChatSession,
  updateChatSessionTitle,
} from "../../api/chat";
import {
  fetchTourDates,
  fetchTourItineraries,
  fetchTourFlights,
  fetchTourHotels,
} from "../../api/chat";
import PriceBreakdown from "./PriceBreakdown";
import { formatMnt } from "../../utils/priceCalculator";

interface Message {
  id: string;
  role: "bot" | "user";
  content: string;
  timestamp: Date;
}

interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  messages: Message[];
  priceResult: { total: number; breakdown: PriceBreakdownItem[] } | null;
  createdAt: Date;
  status: "active" | "completed";
}

interface ChatbotSelection {
  tour: TourForChat | null;
  tourDate: ChatTourDate | null;
  travelers: number;
  itinerary: TourItinerary | null;
  flight: TourFlight | null;
  transport: CarType | null;
  hotel: TourHotel | null;
  activities: (ItineraryItem | TourItinerary)[];
}

const emptySelection: ChatbotSelection = {
  tour: null,
  tourDate: null,
  travelers: 0,
  itinerary: null,
  flight: null,
  transport: null,
  hotel: null,
  activities: [],
};

const initialGreeting = `👋 Сайн байна уу!

Би танд аялалын үнэ тооцоолонгоо тусална. 🎯

"Эхлэх" товчийг дарж аяллаа сонгоно уу.`;

const QUESTIONS: Record<ChatState, string> = {
  greeting: initialGreeting,
  tour_selection: "🎯 Та аль аяллыг сонгох вэ?",
  date_selection: "📅 Ямар огноотой аялах вэ?",
  travelers: "👥 Хэдэн хүн явах вэ?",
  itinerary_selection:
    "🎁 Нэмэлт үйлчилгээ сонгоно уу:\n(Дугаар бичнэ үү, жишээ: 1,2,3)\nҮгүй бол 0 бичнэ үү)",
  flight_selection: "✈️ Ямар нислэг сонгох вэ?",
  transport_selection: "🚗 Ямар тээвэр сонгох вэ?",
  hotel_selection: "🏨 Ямар зочид буудал сонгох вэ?",
  summary: "📋 Таны сонголтууд:",
  calculating: "⏳ Тооцоолж байна...",
  result: "",
  // Legacy states for backward compatibility
  destination: "📍 Ямар улс/хот руу явах вэ?",
  dates: "📅 Хэдийд явах вэ?",
  people: "👥 Хэдэн хүн явах вэ?",
  hotel: "🏨 Ямар зочид буудал сонгох вэ?",
  flight: "✈️ Ямар нислэг сонгох вэ?",
  itinerary: "📋 Ямар үйлчилгээг сонгох вэ?",
  car: "🚗 Ямар машин сонгох вэ?",
};

const TOUR_SELECTION_PROMPT = "🎯 Аялууд:\n\n";

const DESTINATION_CHIPS = ["Солонгос", "Япон", "Тайланд", "Вьетнам", "Монгол"];
const FLIGHT_CLASSES = [
  { id: "economy", name: "Economy", multiplier: 1.0, icon: "💺" },
  { id: "business", name: "Business", multiplier: 2.5, icon: "💼" },
  { id: "first", name: "First", multiplier: 4.0, icon: "👑" },
];

interface ExtendedConversationData extends ConversationData {
  flightClass: "economy" | "business" | "first";
  flightMultiplier: number;
}

const emptyData: ExtendedConversationData = {
  destination: "",
  startDate: "",
  endDate: "",
  people: 0,
  hotelType: "3star",
  flightClass: "economy",
  flightMultiplier: 1.0,
  itineraryItems: [],
  carType: "",
};

export default function ConversationalChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentState, setCurrentState] = useState<ChatState>("greeting");
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [priceConfigs, setPriceConfigs] = useState<any[]>([]);
  const [carTypes, setCarTypes] = useState<CarType[]>([]);
  const [tours, setTours] = useState<TourForChat[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [priceResult, setPriceResult] = useState<{
    total: number;
    breakdown: PriceBreakdownItem[];
  } | null>(null);

  // New selection state for the new flow
  const [selection, setSelection] = useState<ChatbotSelection>(emptySelection);
  const [tourDates, setTourDates] = useState<ChatTourDate[]>([]);
  const [tourItineraries, setTourItineraries] = useState<TourItinerary[]>([]);
  const [tourFlights, setTourFlights] = useState<TourFlight[]>([]);
  const [tourHotels, setTourHotels] = useState<TourHotel[]>([]);

  // Multi-select state for activities
  const [tempSelectedActivityIds, setTempSelectedActivityIds] = useState<
    string[]
  >([]);

  // Legacy state (kept for compatibility)
  const [conversationData, setConversationData] =
    useState<ExtendedConversationData>(emptyData);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  // Legacy state - using new selection state instead
  // const [selectedTour, setSelectedTour] = useState<TourInChat | null>(null);

  // Chat History State
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [activeView, setActiveView] = useState<"chat" | "history">("chat");

  useEffect(() => {
    const loadData = async () => {
      try {
        const { supabase } = await import("../../supabaseClient");

        const [
          configs,
          cars,
          items,
          destResult,
          toursData,
          {
            data: { user },
          },
        ] = await Promise.all([
          fetchPriceConfigs(),
          fetchCarTypes(),
          fetchItineraryItems(),
          // Destinations - handle gracefully if table doesn't exist
          (async () => {
            try {
              const { data, error } = await supabase
                .from("destinations")
                .select("*")
                .eq("is_active", true)
                .order("display_order");
              if (error) {
                console.warn(
                  "[Chat] destinations table not available:",
                  error.message,
                );
                return [];
              }
              return data || [];
            } catch (e) {
              console.warn("[Chat] destinations fetch failed:", e);
              return [];
            }
          })(),
          fetchToursForChat(),
          supabase.auth.getUser(),
        ]);

        setPriceConfigs(configs);
        setCarTypes(cars);
        setItineraryItems(items);
        setDestinations(destResult || []);
        setTours(toursData);

        // Load chat history from localStorage
        const savedHistory = localStorage.getItem("chat_history");
        if (savedHistory) {
          try {
            const parsed = JSON.parse(savedHistory);
            setChatHistory(
              parsed.map((item: any) => ({
                ...item,
                createdAt: new Date(item.createdAt),
                messages: item.messages.map((m: any) => ({
                  ...m,
                  timestamp: new Date(m.timestamp),
                })),
              })),
            );
          } catch (e) {
            console.error("Failed to parse chat history:", e);
          }
        }

        // Also try to load from Supabase if user is logged in
        if (user) {
          const dbSessions = await getChatSessionsWithMessages(user.id);
          if (dbSessions && dbSessions.length > 0) {
            // Convert DB sessions to local history format
            const dbHistory: ChatHistoryItem[] = await Promise.all(
              dbSessions.map(async (s) => {
                const sessionMessages = await fetchSessionMessages(s.id);
                const lastMessageWithPrice = [...sessionMessages]
                  .reverse()
                  .find((m) => m.conversation_data?.priceResult);
                return {
                  id: s.id,
                  title:
                    s.title ||
                    `Чат ${new Date(s.created_at).toLocaleDateString("mn-MN")}`,
                  preview:
                    sessionMessages[0]?.content?.substring(0, 50) ||
                    "No messages",
                  messages: sessionMessages.map((m) => ({
                    id: m.id,
                    role: m.role as "bot" | "user",
                    content: m.content,
                    timestamp: new Date(m.created_at),
                  })),
                  priceResult:
                    lastMessageWithPrice?.conversation_data?.priceResult ||
                    null,
                  createdAt: new Date(s.created_at),
                  status: s.status as "active" | "completed",
                };
              }),
            );
            setChatHistory((prev) => {
              const merged = [...prev];
              dbHistory.forEach((dbItem) => {
                if (!merged.find((h) => h.id === dbItem.id)) {
                  merged.push(dbItem);
                }
              });
              return merged;
            });
          }
        }

        if (user) {
          const newSession = await createChatSession(user.id);
          setSession(newSession);
        }

        setMessages([
          {
            id: "1",
            role: "bot",
            content: initialGreeting,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        console.error("Failed to load data:", err);
      }
    };
    loadData();
  }, []);

  // Auto-scroll removed - user controls scroll

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem("chat_history", JSON.stringify(chatHistory));
    }
  }, [chatHistory]);

  // Auto-save to history when price result is calculated
  useEffect(() => {
    if (priceResult && messages.length > 1) {
      saveToHistory();
    }
  }, [priceResult]);

  const addMessage = (role: "bot" | "user", content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // Save current chat to history when price result is ready
  const saveToHistory = useCallback(() => {
    if (messages.length <= 1) return; // Don't save just the greeting

    const newHistoryItem: ChatHistoryItem = {
      id: currentHistoryId || Date.now().toString(),
      title: generateChatTitle(),
      preview:
        messages.find((m) => m.role === "user")?.content?.substring(0, 50) ||
        "Чат",
      messages: [...messages],
      priceResult: priceResult,
      createdAt: new Date(),
      status: priceResult ? "completed" : "active",
    };

    setChatHistory((prev) => {
      const existing = prev.findIndex((h) => h.id === newHistoryItem.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newHistoryItem;
        return updated;
      }
      return [newHistoryItem, ...prev];
    });

    setCurrentHistoryId(newHistoryItem.id);
  }, [messages, priceResult, currentHistoryId]);

  const generateChatTitle = (): string => {
    const userMsg = messages.find((m) => m.role === "user");
    if (!userMsg) return `Чат ${new Date().toLocaleDateString("mn-MN")}`;

    // Try to extract destination from messages
    const destMatch = userMsg.content.match(
      /(Солонгос|Япон|Тайланд.Вьетнам|Монгол)/,
    );
    if (destMatch) {
      return `${destMatch[0]} аялал`;
    }

    // Try to get from selection
    if (selection.tour) {
      return `${selection.tour.title || selection.tour.name} аялал`;
    }

    return `Чат ${new Date().toLocaleDateString("mn-MN")}`;
  };

  // Load a chat from history
  const loadChatFromHistory = (historyItem: ChatHistoryItem) => {
    setMessages(historyItem.messages);
    setCurrentHistoryId(historyItem.id);
    setPriceResult(historyItem.priceResult);

    // Restore conversation data
    if (historyItem.priceResult) {
      setCurrentState("result");
    } else {
      // Try to determine state from last message
      const lastBotMsg = [...historyItem.messages]
        .reverse()
        .find((m) => m.role === "bot");
      if (
        lastBotMsg?.content.includes("машин") ||
        lastBotMsg?.content.includes("тээвэр")
      ) {
        setCurrentState("transport_selection");
      } else if (lastBotMsg?.content.includes("маршрут")) {
        setCurrentState("itinerary_selection");
      } else if (lastBotMsg?.content.includes("зочид")) {
        setCurrentState("hotel_selection");
      } else if (lastBotMsg?.content.includes("нислэг")) {
        setCurrentState("flight_selection");
      } else if (lastBotMsg?.content.includes("хүн")) {
        setCurrentState("travelers");
      } else if (lastBotMsg?.content.includes("огноо")) {
        setCurrentState("date_selection");
      } else if (
        lastBotMsg?.content.includes("аялал") ||
        lastBotMsg?.content.includes("сонгох")
      ) {
        setCurrentState("tour_selection");
      } else {
        setCurrentState("greeting");
      }
    }

    setShowHistory(false);
  };

  // Delete a chat from history
  const deleteHistoryItem = (id: string) => {
    setChatHistory((prev) => prev.filter((h) => h.id !== id));
    localStorage.setItem(
      "chat_history",
      JSON.stringify(chatHistory.filter((h) => h.id !== id)),
    );

    if (currentHistoryId === id) {
      resetChat();
    }
  };

  // Rename a chat in history
  const renameHistoryItem = (id: string, newTitle: string) => {
    setChatHistory((prev) =>
      prev.map((h) => (h.id === id ? { ...h, title: newTitle } : h)),
    );
    setEditingTitleId(null);
  };

  const processInput = async (forcedInput?: string) => {
    const inputToUse = forcedInput !== undefined ? forcedInput : inputValue;
    if (!inputToUse.trim()) return;

    const userInput = inputToUse.trim();
    addMessage("user", userInput);
    setInputValue("");
    setIsTyping(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    switch (currentState) {
      case "greeting":
        if (
          userInput === "Эхлэх" ||
          userInput.toLowerCase().includes("эхлэх") ||
          userInput.toLowerCase() === "start"
        ) {
          const tourPrompt =
            tours.length > 0
              ? TOUR_SELECTION_PROMPT +
                tours
                  .slice(0, 5)
                  .map(
                    (t, i) =>
                      `${i + 1}. ${t.title || t.name} - ${formatMnt(t.price_base || t.base_price || 0)}`,
                  )
                  .join("\n")
              : QUESTIONS.destination;
          setCurrentState("tour_selection");
          addMessage("bot", tourPrompt);
        } else {
          addMessage(
            "bot",
            '🎯 Тооцоо эхлэхийн тулд "Эхлэх" товчийг дарна уу эсвэл "Эхлэх" гэж бичиж илгээгээрэй.',
          );
        }
        break;

      case "tour_selection":
        // Remove duplicate setCurrentState call
        const tourNum = parseInt(userInput);
        if (tourNum > 0 && tourNum <= tours.length) {
          const tour = tours[tourNum - 1];

          // Log tour selection
          console.log(
            `[Chat] Tour selected: ${tour.title || tour.name}, type: ${tour.tour_type || "outbound"}`,
          );

          setSelection((prev) => ({ ...prev, tour: tour as TourForChat }));

          // Fetch tour-specific activities
          try {
            const tourActivities = await fetchTourItineraries(tour.id);
            setTourItineraries(tourActivities);
            console.log("[Chat] Tour activities loaded:", tourActivities.length);
          } catch (err) {
            console.warn("[Chat] Failed to load tour activities:", err);
            setTourItineraries([]);
          }

          // Log the selection
          console.log("[Chat] Selection updated with tour:", tour.id);

          if (session) {
            await updateChatSession(session.id, {
              selected_tour_id: tour.id,
              context: {
                tour: tour.title || tour.name,
                tour_type: tour.tour_type,
              },
            });
          }

          // Determine next state based on tour_type
          const nextState = "date_selection";

          // Show dates from tour.dates if available
          const datesPrompt =
            tour.dates && tour.dates.length > 0
              ? `📅 ${tour.title || tour.name}-н ${tour.dates.length} өдөр:\n${tour.dates.slice(0, 5).join(", ")}\n\nӨөр огноо хүсэж байна уу? Огноогоо бичнэ үү (YYYY-MM-DD):`
              : `📅 Хэдийд явах вэ?\nОгноогоо YYYY-MM-DD форматаар бичнэ үү.`;

          console.log(
            `[Chat] Moving to state: ${nextState}, tour_type: ${tour.tour_type}`,
          );

          setCurrentState(nextState);
          addMessage(
            "bot",
            `✅ ${tour.title || tour.name} сонгосон!\n\n${datesPrompt}`,
          );
          setIsTyping(false);
          return;
        }

        // If user typed something else (not a number), still allow it as custom input
        if (userInput.length < 2) {
          addMessage("bot", "❌ Аялын дугаар бичнэ үү (1-5).");
          setIsTyping(false);
          return;
        }

        // User typed a custom tour name - create a temporary selection
        setSelection((prev) => ({ ...prev, tour: null }));
        setCurrentState("date_selection");
        addMessage("bot", QUESTIONS.date_selection);
        break;

      case "date_selection":
        const datePattern = /^\d{4}-\d{2}-\d{2}$/;
        if (!datePattern.test(userInput)) {
          addMessage(
            "bot",
            "❌ Огноог YYYY-MM-DD форматаар бичнэ үү.\nЖишээ: 2024-06-15",
          );
          setIsTyping(false);
          return;
        }

        // Store the selected date
        console.log(`[Chat] Date selected: ${userInput}`);

        setSelection((prev) => ({
          ...prev,
          tourDate: {
            id: userInput,
            tour_id: prev.tour?.id || "",
            departure_date: userInput,
            return_date: null,
            available_seats: prev.tour?.seats || 0,
            is_active: true,
            price_modifier: 0,
            created_at: new Date().toISOString(),
          },
        }));

        setCurrentState("travelers");
        addMessage("bot", QUESTIONS.travelers);
        break;

      case "travelers":
        const num = parseInt(userInput);
        if (isNaN(num) || num < 1 || num > 50) {
          addMessage(
            "bot",
            "❌ Хүний тоо 1-50 хооронд байна. Дахин оролдоно уу.",
          );
          setIsTyping(false);
          return;
        }

        console.log(
          `[Chat] Travelers: ${num}, tour_type: ${selection.tour?.tour_type || "outbound"}`,
        );

        setSelection((prev) => ({ ...prev, travelers: num }));

        // Go to activity selection
        setCurrentState("itinerary_selection");
        addMessage("bot", QUESTIONS.itinerary_selection);
        break;

      case "itinerary_selection":
        // Handle activity selection - accept numbers like "1,2,3" or "1 2 3" or just list
        const selectedIndices = userInput
          .split(/[, ]+/)
          .map((s) => parseInt(s.trim()) - 1)
          .filter((i) => !isNaN(i) && i >= 0 && i < itineraryItems.length);

        const selectedItems = selectedIndices.map((i) => itineraryItems[i]);
        console.log(
          `[Chat] Activities selected: ${selectedItems.map((i) => i.name).join(", ")}`,
        );

        setSelection((prev) => ({ ...prev, activities: selectedItems }));

        // Then go to hotel selection
        setCurrentState("hotel_selection");
        addMessage("bot", QUESTIONS.hotel_selection);
        break;

      case "flight_selection":
        const flightClass = FLIGHT_CLASSES.find(
          (fc) =>
            userInput.toLowerCase().includes(fc.id) ||
            fc.name.toLowerCase().includes(userInput.toLowerCase()),
        );
        if (!flightClass) {
          addMessage("bot", "❌ Economy, Business, эсвэл First сонгоно уу.");
          setIsTyping(false);
          return;
        }

        console.log(
          `[Chat] Flight class selected: ${flightClass.id}, multiplier: ${flightClass.multiplier}`,
        );

        setSelection((prev) => ({
          ...prev,
          flight: {
            id: flightClass.id,
            tour_id: prev.tour?.id || "",
            airline: flightClass.name,
            departure_time: null,
            arrival_time: null,
            price_modifier: 0,
            flight_class: flightClass.id as "economy" | "business" | "first",
            is_active: true,
            created_at: new Date().toISOString(),
          },
        }));

        setCurrentState("hotel_selection");
        addMessage("bot", QUESTIONS.hotel_selection);
        break;

      case "transport_selection":
        const selectedCar = carTypes.find(
          (c) =>
            c.name.toLowerCase().includes(userInput.toLowerCase()) ||
            userInput.toLowerCase().includes(c.name.toLowerCase()),
        );

        if (!selectedCar) {
          addMessage(
            "bot",
            `❌ Машин сонгоно уу. ${carTypes.map((c) => c.name).join(", ")}`,
          );
          setIsTyping(false);
          return;
        }

        console.log(
          `[Chat] Transport selected: ${selectedCar.name}, price: ${selectedCar.price_per_day}`,
        );

        setSelection((prev) => ({ ...prev, transport: selectedCar }));

        setCurrentState("hotel_selection");
        addMessage("bot", QUESTIONS.hotel_selection);
        break;

      case "hotel_selection":
        // Use hotels from tour if available, otherwise fallback to star rating
        const tourHotels = selection.tour?.hotels;
        let selectedHotel = null;

        // Check if user selected from tour's embedded hotels
        if (Array.isArray(tourHotels) && tourHotels.length > 0) {
          const hotelIndex = parseInt(userInput) - 1;
          if (hotelIndex >= 0 && hotelIndex < tourHotels.length) {
            const hotelName = tourHotels[hotelIndex];
            selectedHotel = {
              id: hotelIndex.toString(),
              tour_id: selection.tour?.id || "",
              name: hotelName,
              star_rating: 4, // Default since embedded hotels don't have star rating
              price_per_night: null,
              description: null,
              image_url: null,
              is_active: true,
              created_at: new Date().toISOString(),
            };
          }
        }

        // Fallback: check for star rating input
        if (!selectedHotel) {
          const hotelMap: Record<string, number> = {
            "3": 3,
            "3★": 3,
            "3 одой": 3,
            "4": 4,
            "4★": 4,
            "4 одой": 4,
            "5": 5,
            "5★": 5,
            "5 одой": 5,
          };
          const starRating = hotelMap[userInput.toLowerCase()];
          if (starRating) {
            selectedHotel = {
              id: `star-${starRating}`,
              tour_id: selection.tour?.id || "",
              name: `${starRating}★ Зочид буудал`,
              star_rating: starRating,
              price_per_night: null,
              description: null,
              image_url: null,
              is_active: true,
              created_at: new Date().toISOString(),
            };
          }
        }

        if (!selectedHotel) {
          addMessage("bot", "❌ Зочид буудал сонгоно уу (3★, 4★, эсвэл 5★).");
          setIsTyping(false);
          return;
        }

        console.log(
          `[Chat] Hotel selected: ${selectedHotel.name}, stars: ${selectedHotel.star_rating}`,
        );

        setSelection((prev) => ({ ...prev, hotel: selectedHotel }));

        // Go to summary/calculating
        setCurrentState("calculating");
        addMessage("bot", QUESTIONS.calculating);

        // Calculate price with new selection
        await calculatePriceWithSelection();
        break;

      default:
        break;
    }

    setIsTyping(false);
  };

  // New price calculation using selection state
  const calculatePriceWithSelection = async () => {
    try {
      const { tour, tourDate, travelers, flight, transport, hotel } = selection;

      console.log("[Chat] calculatePriceWithSelection called with:", {
        tour: tour?.title,
        tourDate,
        travelers,
        flight,
        transport,
        hotel,
      });

      if (!tour) {
        addMessage("bot", "❌ Аялал сонгогдоогүй байна.");
        setCurrentState("greeting");
        return;
      }

      const config =
        priceConfigs.find((c) => c.destination === "Монгол") || priceConfigs[0];
      if (!config) {
        addMessage(
          "bot",
          "❌ Тооцооны мэдээлэл олдсонгүй. Админтай холбоо барина уу.",
        );
        setCurrentState("greeting");
        return;
      }

      const days = tourDate?.departure_date ? 1 : 1; // Default to 1 day if no end date
      const numTravelers = travelers || 1;

      const seasonalMultiplier = await getSeasonalMultiplier(
        "Монгол",
        tourDate?.departure_date || new Date().toISOString(),
      );

      const breakdown: PriceBreakdownItem[] = [];

      // Base tour price
      const basePrice = tour.base_price || tour.price_base || 0;
      breakdown.push({
        item: "🎯 Аяллын үнэ",
        quantity: numTravelers,
        unitPrice: basePrice,
        total: basePrice * numTravelers,
      });

      // Flight cost (for outbound)
      if (flight) {
        const flightMultiplier =
          FLIGHT_CLASSES.find((f) => f.id === flight.flight_class)
            ?.multiplier || 1;
        const flightPrice =
          (config.flight_price_per_person || 500000) *
          seasonalMultiplier *
          flightMultiplier;
        breakdown.push({
          item: "✈️ Нислэг",
          quantity: numTravelers,
          unitPrice: Math.round(flightPrice),
          total: Math.round(flightPrice * numTravelers),
        });
      }

      // Transport cost (for inbound)
      if (transport) {
        breakdown.push({
          item: "🚗 Тээвэр",
          quantity: days,
          unitPrice: transport.price_per_day,
          total: transport.price_per_day * days,
        });
      }

      // Hotel cost
      if (hotel) {
        const hotelStarPrices: Record<number, number> = {
          3: config.hotel_3star_price_per_night || 150000,
          4: config.hotel_4star_price_per_night || 250000,
          5: config.hotel_5star_price_per_night || 400000,
        };
        const hotelPrice = hotelStarPrices[hotel.star_rating] || 150000;
        breakdown.push({
          item: `🏨 Зочид буудал (${hotel.star_rating}★)`,
          quantity: days * numTravelers,
          unitPrice: Math.round(hotelPrice * seasonalMultiplier),
          total: Math.round(
            hotelPrice * seasonalMultiplier * days * numTravelers,
          ),
        });
      }

      // Activities/Itinerary items cost
      if (selection.activities && selection.activities.length > 0) {
        for (const activity of selection.activities) {
          let activityTotal = 0;
          let activityQuantity = 1;
          let priceValue = 0;

          // Check if it's a TourItinerary or ItineraryItem
          const tourItinerary = activity as unknown as { price_modifier?: number; price_model?: string; price_value?: number };
          
          // TourItinerary uses price_modifier, ItineraryItem uses price_value
          if ('price_modifier' in activity) {
            priceValue = tourItinerary.price_modifier || 0;
            activityTotal = priceValue; // Fixed price for tour activities
          } else if ('price_value' in activity) {
            priceValue = tourItinerary.price_value || 0;
            const priceModel = (activity as ItineraryItem).price_model;
            
            if (priceModel === "per_person") {
              activityQuantity = numTravelers;
              activityTotal = priceValue * numTravelers;
            } else if (priceModel === "per_day") {
              activityQuantity = days;
              activityTotal = priceValue * days;
            } else {
              activityTotal = priceValue;
            }
          }

          breakdown.push({
            item: `🎁 ${activity.name}`,
            quantity: activityQuantity,
            unitPrice: priceValue,
            total: activityTotal,
          });
        }
      }

      // Calculate total
      const total = breakdown.reduce((sum, item) => sum + item.total, 0);

      console.log("[Chat] Price calculated:", {
        total,
        breakdown: breakdown.map((b) => ({ item: b.item, total: b.total })),
      });

      setPriceResult({ total, breakdown });

      // Show summary
      let summaryMsg = "📋 ТАНЫ СОНГОЛТ:\n\n";
      summaryMsg += `🎯 Аялал: ${tour.title || tour.name}\n`;
      if (tourDate) summaryMsg += `📅 Огноо: ${tourDate.departure_date}\n`;
      if (travelers) summaryMsg += `👥 Хүний тоо: ${travelers}\n`;
      if (selection.activities && selection.activities.length > 0) {
        summaryMsg += `🎁 Үйлчилгээ: ${selection.activities.map((a) => a.name).join(", ")}\n`;
      }
      if (flight) summaryMsg += `✈️ Нислэг: ${flight.flight_class}\n`;
      if (transport) summaryMsg += `🚗 Тээвэр: ${transport.name}\n`;
      if (hotel) summaryMsg += `🏨 Зочид: ${hotel.name}\n`;
      summaryMsg += `\n💰 НИЙТ: ${formatMnt(total)}`;
      summaryMsg += `\n Хэрэв та захиалга өгөх бол чиглүүлсэн урсгал руу орж хүсэлтээ илгээнэ үү.`;
      addMessage("bot", summaryMsg);
      setCurrentState("result");
    } catch (err) {
      console.error("[Chat] Price calculation error:", err);
      addMessage("bot", "❌ Тооцоо хийхэд алдаа гарлаа. Дахин оролдоно уу.");
      setCurrentState("greeting");
    }
  };

  const resetChat = () => {
    // Save current chat to history before resetting if it has content
    if (messages.length > 1) {
      saveToHistory();
    }
    setMessages([
      {
        id: "1",
        role: "bot",
        content: initialGreeting,
        timestamp: new Date(),
      },
    ]);
    setCurrentState("greeting");
    setConversationData(emptyData);
    setPriceResult(null);
    setSelection(emptySelection);
    setTempSelectedActivityIds([]);
    setCurrentHistoryId(null);
  };

  const handleQuickReply = (value: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Pass value directly to processInput to avoid async state timing issues
    setIsTyping(true);
    setTimeout(() => processInput(value), 100);
  };

  const renderOptions = () => {
    if (isTyping) return null;

    if (currentState === "greeting") {
      const hasTours = tours.length > 0;
      return (
        <div className="mt-2 space-y-3">
          <button
            onClick={(e) => handleQuickReply("Эхлэх", e)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 hover:shadow-lg transition-all duration-200 active:scale-95 font-medium"
          >
            Эхлэх
          </button>

          {hasTours && (
            <div className="mt-3">
              <p className="text-sm text-gray-600 mb-2">
                Эсвэл доорхийн аялуудаас сонгоно уу:
              </p>
              <div className="flex flex-wrap gap-2">
                {tours.slice(0, 5).map((tour, idx) => (
                  <button
                    key={tour.id}
                    onClick={(e) => handleQuickReply(String(idx + 1), e)}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 hover:scale-105 hover:shadow-md transition-all duration-200 active:scale-95 text-sm flex flex-col items-start"
                  >
                    <span className="font-medium">
                      {tour.title || tour.name}
                    </span>
                    <span className="text-xs">
                      {formatMnt(tour.price_base || tour.base_price || 0)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentState === "tour_selection") {
      // Show tours as quick options if user hasn't selected one yet
      if (tours.length > 0 && !selection.tour) {
        return (
          <div className="mt-2">
            <p className="text-sm text-gray-600 mb-2">
              Эсвэл доорхийн аялуудаас сонгоно уу (дугаар бичнэ үү):
            </p>
            <div className="flex flex-col gap-2">
              {tours.slice(0, 5).map((tour, idx) => (
                <button
                  key={tour.id}
                  onClick={(e) => handleQuickReply(String(idx + 1), e)}
                  className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:scale-[1.02] hover:shadow-md transition-all duration-200 active:scale-95 text-sm"
                >
                  <div className="flex flex-col items-start">
                    <span className="font-medium text-green-800">
                      {tour.title || tour.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {tour.dates?.[0] || tour.departure_date || ""} ·{" "}
                      {tour.available_seats || tour.seats || 0} vacan
                    </span>
                  </div>
                  <span className="font-bold text-green-700">
                    {formatMnt(tour.price_base || tour.base_price || 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      }

      // Fallback to destination chips
      const chips =
        destinations.length > 0
          ? destinations.slice(0, 6).map((d) => d.name)
          : DESTINATION_CHIPS;
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          {chips.map((dest) => (
            <button
              key={dest}
              onClick={(e) => handleQuickReply(dest, e)}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 hover:scale-105 hover:shadow-md transition-all duration-200 active:scale-95 text-sm"
            >
              {dest}
            </button>
          ))}
        </div>
      );
    }

    if (currentState === "date_selection") {
      const tourDates = selection.tour?.dates || [];
      const hasDates = tourDates.length > 0;
      return (
        <div className="mt-2">
          {hasDates ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600 mb-1">
                👆Өөр огноо сонгоно уу:
              </p>
              <div className="flex flex-wrap gap-2">
                {tourDates.slice(0, 6).map((date, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => handleQuickReply(date, e)}
                    className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:scale-105 hover:shadow-md transition-all duration-200 active:scale-95 text-sm text-green-700"
                  >
                    {date}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Огноогоо YYYY-MM-DD форматаар бичнэ үү
            </p>
          )}
        </div>
      );
    }

    if (currentState === "travelers") {
      return (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                onClick={(e) => handleQuickReply(String(num), e)}
                className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:scale-105 hover:shadow-md transition-all duration-200 active:scale-95 text-green-700 font-medium"
              >
                {num}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Эсвэл өөр тоо бичнэ үү (1-50)
          </p>
        </div>
      );
    }

    if (currentState === "itinerary_selection") {
      // Use tour-specific activities (tourItineraries) instead of global (itineraryItems)
      const currentActivities = tourItineraries.length > 0 ? tourItineraries : itineraryItems;

      // Helper to toggle activity selection
      const toggleActivity = (itemId: string) => {
        setTempSelectedActivityIds((prev) =>
          prev.includes(itemId)
            ? prev.filter((id) => id !== itemId)
            : [...prev, itemId],
        );
      };

      // Handle confirm button
      const handleConfirmActivities = () => {
        const selectedItems = currentActivities.filter((item) =>
          tempSelectedActivityIds.includes(item.id),
        );

        console.log(
          `[Chat] Activities confirmed: ${selectedItems.map((i) => i.name).join(", ")}`,
        );

        setSelection((prev) => ({ ...prev, activities: selectedItems }));

        setCurrentState("hotel_selection");
        addMessage("bot", QUESTIONS.hotel_selection);
        setIsTyping(false);
      };

      // Handle skip (no activities)
      const handleSkipActivities = (e: React.MouseEvent) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        setTempSelectedActivityIds([]);

        setCurrentState("hotel_selection");
        addMessage("bot", QUESTIONS.hotel_selection);
        setIsTyping(false);
      };

      if (currentActivities.length === 0) {
        return (
          <div className="mt-2 text-sm text-gray-500">
            <p>Үйлчилгээ олдсонгүй.</p>
            <button
              onClick={handleSkipActivities}
              className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Үргэлжлэх
            </button>
          </div>
        );
      }

      return (
        <div className="mt-2">
          <p className="text-sm text-gray-600 mb-2">
            Сонгохдоо дарж сонгоно уу. Болсон товчийг дарж баталгаа中毒.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {currentActivities.map((item, idx) => {
              const isSelected = tempSelectedActivityIds.includes(item.id);
              
              // Get price - TourItinerary uses price_modifier, ItineraryItem uses price_value
              const priceValue = 'price_modifier' in item 
                ? (item as TourItinerary).price_modifier 
                : (item as ItineraryItem).price_value;
              
              return (
                <button
                  key={item.id}
                  onClick={() => toggleActivity(item.id)}
                  className={`px-3 py-2 rounded-lg border text-sm flex flex-col items-start transition-all duration-200 ${
                    isSelected
                      ? "bg-purple-600 text-white border-purple-600 shadow-md scale-105"
                      : "bg-purple-50 border-purple-200 hover:bg-purple-100 hover:scale-105 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? "border-white bg-white"
                          : "border-purple-300"
                      }`}
                    >
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                      )}
                    </span>
                    <span
                      className={`font-medium ${isSelected ? "text-white" : "text-purple-700"}`}
                    >
                      {idx + 1}. {item.name}
                    </span>
                  </div>
                  <span
                    className={`text-xs ml-6 ${isSelected ? "text-purple-200" : "text-purple-600"}`}
                  >
                    {formatMnt(priceValue || 0)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Confirm and Skip buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSkipActivities}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
            >
              Үгүй
            </button>
            <button
              onClick={handleConfirmActivities}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Болсон ({tempSelectedActivityIds.length})
            </button>
          </div>
        </div>
      );
    }

    if (currentState === "hotel") {
      return (
        <div className="flex gap-2 mt-2">
          {["3★", "4★", "5★"].map((hotel) => (
            <button
              key={hotel}
              onClick={(e) => handleQuickReply(hotel, e)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              {hotel}
            </button>
          ))}
        </div>
      );
    }

    if (currentState === "flight") {
      return (
        <div className="flex gap-2 mt-2">
          {FLIGHT_CLASSES.map((fc) => (
            <button
              key={fc.id}
              onClick={(e) => handleQuickReply(fc.name, e)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <span>{fc.icon}</span>
              <span>{fc.name}</span>
            </button>
          ))}
        </div>
      );
    }

    if (currentState === "car") {
      return (
        <div className="flex flex-wrap gap-2 mt-2">
          {carTypes.map((car) => (
            <button
              key={car.id}
              onClick={(e) => handleQuickReply(car.name, e)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:scale-105 hover:shadow-lg transition-all duration-200 active:scale-95"
            >
              {car.name} ({formatMnt(car.price_per_day)}/өдөр)
            </button>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-full bg-linear-to-br from-gray-50 to-gray-100 rounded-2xl overflow-hidden shadow-2xl">
      {/* Left Sidebar - History Panel */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-linear-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Тооцоо Chat</h3>
              <p className="text-xs text-gray-400">аялал төлөвлөгч</p>
            </div>
          </div>

          {/* New Chat Button */}
          <button
            onClick={resetChat}
            className="w-full py-2.5 bg-linear-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            Шинэ чат
          </button>
        </div>

        {/* View Toggle */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView("chat")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                activeView === "chat"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              💬 Чат
            </button>
            <button
              onClick={() => setActiveView("history")}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                activeView === "history"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📋 Түүх
            </button>
          </div>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeView === "history" ? (
            chatHistory.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Түүх хоосон</p>
                <p className="text-xs mt-1">Хадгалсан чат байхгүй</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      loadChatFromHistory(item);
                      setActiveView("chat");
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                      currentHistoryId === item.id
                        ? "bg-blue-50 border-blue-200 shadow-sm"
                        : "bg-gray-50 border-gray-100 hover:bg-white hover:shadow-md hover:border-gray-200"
                    }`}
                  >
                    {editingTitleId === item.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            renameHistoryItem(item.id, editingTitle);
                          if (e.key === "Escape") setEditingTitleId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-800 truncate">
                              {item.title}
                            </span>
                            {item.priceResult && (
                              <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {item.preview}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-gray-400">
                              {item.createdAt.toLocaleDateString("mn-MN")}
                            </p>
                            {item.priceResult && (
                              <p className="text-xs font-bold text-green-600">
                                {formatMnt(item.priceResult.total)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTitleId(item.id);
                              setEditingTitle(item.title);
                            }}
                            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Нэр өөрчлөх"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryItem(item.id);
                            }}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                            title="Устгах"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              {chatHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-6">
                  <p className="text-sm font-medium">Чат эхлүүлэх</p>
                  <p className="text-xs mt-1">Шинэ чат эхлүүлнэ</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Сүүлчийн чатууд
                  </p>
                  {chatHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        loadChatFromHistory(item);
                        setActiveView("chat");
                      }}
                      className={`p-2 rounded-lg cursor-pointer transition-all duration-200 text-sm ${
                        currentHistoryId === item.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="truncate">{item.title}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-linear-to-b from-gray-50 to-white">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2 rounded-2xl transition-all duration-200 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md hover:scale-[1.02]"
                    : "bg-white text-gray-800 rounded-bl-md shadow-sm hover:shadow-md"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-200" : "text-gray-400"}`}
                >
                  {msg.timestamp.toLocaleTimeString("mn-MN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white rounded-lg px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {renderOptions()}

          {currentState === "result" && priceResult && (
            <div className="mt-4">
              <PriceBreakdown
                breakdown={priceResult.breakdown}
                tourName={selection.tour?.title || selection.tour?.name}
                date={selection.tourDate?.departure_date}
                travelers={selection.travelers}
              />
            </div>
          )}

          <div />
        </div>

        {currentState !== "greeting" &&
          currentState !== "calculating" &&
          currentState !== "result" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processInput();
              }}
              className="p-3 border-t border-gray-200 bg-white"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    currentState === "destination"
                      ? "Улс/хот..."
                      : currentState === "dates"
                        ? "YYYY-MM-DD..."
                        : currentState === "people"
                          ? "Хүний тоо..."
                          : currentState === "hotel"
                            ? "3★, 4★, 5★..."
                            : currentState === "itinerary"
                              ? "Гид, Хоол, Тээвэр..."
                              : currentState === "car"
                                ? "Машин сонгох..."
                                : "Хариу..."
                  }
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all duration-200 hover:border-gray-400 focus:hover:border-blue-500"
                  disabled={isTyping}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

        {currentState === "result" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              resetChat();
            }}
            className="p-3 border-t border-gray-200 bg-white"
          >
            <button
              type="submit"
              className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 hover:scale-[1.02] hover:shadow-lg transition-all duration-200 active:scale-95 font-medium flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Шинэ тооцоо
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
