import type {
  ChatApiResponse,
  ChatContext,
  ChatMessage,
  TourForAI,
} from "../types";
import { supabase } from "../../../supabaseClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL || "https://gtrip.mn";

class ChatApiError extends Error {
  constructor(
    public message: string,
    public code?: string,
    public retryable = true,
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

async function getAuthToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ChatApiError("Not authenticated", "AUTH_REQUIRED", false);
  }
  return session.access_token;
}

export async function sendChatMessage(
  message: string,
  context?: ChatContext
): Promise<ChatApiResponse> {
  try {
    let token: string | null = null;

    try {
      token = await getAuthToken();
    } catch {
      console.warn("Guest mode AI");
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/chat/ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ message, context }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API ERROR:", data);
      throw new ChatApiError(
        data.message || 'Failed to send message',
        data.code,
        response.status >= 500
      );
    }

    return data;
  } catch (error: any) {
    console.error("🔥 FULL AI ERROR:", error);
    throw new ChatApiError(error.message || 'Network error');
  }
}

export async function extractBookingDetails(
  message: string,
): Promise<Record<string, unknown>> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/v1/chat/ai/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new ChatApiError(
        "Failed to extract details",
        "EXTRACT_ERROR",
        true,
      );
    }

    const data = await response.json();
    return data.details || {};
  } catch (error) {
    console.error("extractBookingDetails error:", error);
    return {};
  }
}

export async function getGreeting(
  userPreferences?: Record<string, unknown>,
): Promise<string> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/v1/chat/ai/greeting`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userPreferences }),
    });

    if (!response.ok) {
      throw new ChatApiError("Failed to get greeting", "GREETING_ERROR", true);
    }

    const data = await response.json();
    return data.greeting || "Sain baina uu! Bi tand tusulna.";
  } catch (error) {
    console.error("getGreeting error:", error);
    return "Sain baina uu! Bi tand tusulna.";
  }
}

export async function getFollowUp(
  currentDetails: Record<string, unknown>,
  missingFields: string[],
): Promise<string> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${API_BASE_URL}/api/v1/chat/ai/follow-up`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentDetails, missingFields }),
    });

    if (!response.ok) {
      throw new ChatApiError("Failed to get follow-up", "FOLLOWUP_ERROR", true);
    }

    const data = await response.json();
    return data.followUp || "";
  } catch (error) {
    console.error("getFollowUp error:", error);
    return "";
  }
}

let toursCache: { data: TourForAI[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchToursForAI(limit = 20): Promise<TourForAI[]> {
  // Check cache
  if (toursCache && Date.now() - toursCache.timestamp < CACHE_TTL) {
    return toursCache.data;
  }

  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/chat/tours?limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new ChatApiError("Failed to fetch tours", "TOURS_ERROR", true);
    }

    const data = await response.json();
    const tours = (data.tours || []) as TourForAI[];

    // Update cache
    toursCache = {
      data: tours,
      timestamp: Date.now(),
    };

    return tours;
  } catch (error) {
    console.error("fetchToursForAI error:", error);
    return [];
  }
}

export async function fetchCheapestToursForAI(count = 5): Promise<TourForAI[]> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/chat/tours/cheapest?count=${count}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new ChatApiError(
        "Failed to fetch cheapest tours",
        "TOURS_ERROR",
        true,
      );
    }

    const data = await response.json();
    return (data.tours || []) as TourForAI[];
  } catch (error) {
    console.error("fetchCheapestToursForAI error:", error);
    return [];
  }
}

export async function searchToursAI(destination: string): Promise<TourForAI[]> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/chat/tours/search?destination=${encodeURIComponent(destination)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new ChatApiError("Failed to search tours", "TOURS_ERROR", true);
    }

    const data = await response.json();
    return (data.tours || []) as TourForAI[];
  } catch (error) {
    console.error("searchToursAI error:", error);
    return [];
  }
}

export function formatToursForDisplay(tours: TourForAI[]): string {
  if (tours.length === 0) {
    return "Идэвхтэй аял олдсонгүй.";
  }

  const lines = [`**Идэвхтэй аялууд:**\n`];

  for (const tour of tours) {
    const priceStr = (tour.base_price || 0).toLocaleString("mn-MN");
    const dateStr = tour.departure_date
      ? new Date(tour.departure_date).toLocaleDateString("mn-MN")
      : "Тодорхойгүй";

    lines.push(`**${tour.title}**`);
    lines.push(`- 📍 ${tour.destination}`);
    lines.push(`- 💰 ${priceStr}₮`);
    lines.push(`- 📅 ${dateStr} (${tour.duration_day} хоног)`);
    lines.push(`- 💺 ${tour.seats} суудал`);
    lines.push("");
  }

  return lines.join("\n");
}
