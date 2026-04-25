import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, ChatContext, ChatErrorState, QuickSuggestion, ChatWidgetState, TourResult } from './types';
import { DEFAULT_QUICK_SUGGESTIONS } from './types';
import { sendChatMessage, getGreeting } from './api/chatApi';

interface ChatbotState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: ChatErrorState | null;
  quickSuggestions: QuickSuggestion[];
  locale: 'en' | 'mn';
  widgetState: ChatWidgetState;
  conversationTitle: string;
  
  setWidgetState: (state: ChatWidgetState) => void;
  setLocale: (locale: 'en' | 'mn') => void;
  setQuickSuggestions: (suggestions: QuickSuggestion[]) => void;
  clearError: () => void;
  
  sendMessage: (text: string) => Promise<void>;
  retryMessage: (id: string) => Promise<void>;
  loadGreeting: () => Promise<void>;
}

const useChatbotStore = create<ChatbotState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  quickSuggestions: DEFAULT_QUICK_SUGGESTIONS,
  locale: (localStorage.getItem('chatbot-locale') as 'en' | 'mn') || 'mn',
  widgetState: 'minimized',
  conversationTitle: 'New Conversation',

  setWidgetState: (state) => set({ widgetState: state }),
  setLocale: (locale) => {
    localStorage.setItem('chatbot-locale', locale);
    set({ locale });
  },

  setQuickSuggestions: (suggestions) => set({ quickSuggestions: suggestions }),

  clearError: () => set({ error: null }),

  sendMessage: async (text: string) => {
    const { messages, locale, conversationTitle, setQuickSuggestions } = get();
    
    const userMessage: ChatMessage = {
      id: uuidv4(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      isStreaming: true,
      error: null,
      conversationTitle: state.conversationTitle === 'New Conversation' && text.length < 30
        ? text.slice(0, 30) + (text.length > 30 ? '...' : '')
        : state.conversationTitle,
    }));

    try {
      const conversationHistory = messages
        .filter((m) => m.sender === 'user' || m.sender === 'ai')
        .map((m) => `${m.sender === 'user' ? 'User' : 'Bot'}: ${m.text}`)
        .slice(-10);

      const context: ChatContext = {
        conversationHistory,
        locale,
      };

      const response = await sendChatMessage(text, context);
      
      const aiMessageId = uuidv4();
      const fullResponse = response.reply;

      // Extract tours from response
      const tours: TourResult[] = response.tours || [];
      const messageType = response.type || 'conversation';

      set((state) => ({
        messages: [...state.messages, {
          id: aiMessageId,
          text: '',
          sender: 'ai',
          timestamp: new Date(),
          markdown: true,
          streaming: true,
          tours,
          messageType,
        }],
      }));

      await streamResponse(aiMessageId, fullResponse);

      if (response.suggestions && response.suggestions.length > 0) {
        const suggestions: QuickSuggestion[] = response.suggestions.map((s, i) => ({
          id: uuidv4(),
          text: s,
          textEn: s,
          textMn: s,
        }));
        set({ quickSuggestions: suggestions });
      }

      set((state) => {
        const newMessages = state.messages.map((m) =>
          m.id === aiMessageId ? { ...m, streaming: false } : m
        );
        return { messages: newMessages, isLoading: false, isStreaming: false };
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      const isRetryable = !errorMessage.includes('Auth') && !errorMessage.includes('authenticated');
      
      set((state) => {
        const newMessages = state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.sender === 'ai'
            ? { ...m, errored: true }
            : m
        );
        return {
          messages: newMessages,
          isLoading: false,
          isStreaming: false,
          error: { message: errorMessage, retryable: isRetryable },
        };
      });
    }
  },

  retryMessage: async (id: string) => {
    const { messages } = get();
    const messageToRetry = messages.find((m) => m.id === id);
    if (!messageToRetry || messageToRetry.sender !== 'user') return;

    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, errored: false } : m
      ),
      isLoading: true,
      error: null,
    }));

    try {
      const conversationHistory = messages
        .filter((m) => m.sender === 'user' || m.sender === 'ai')
        .map((m) => `${m.sender === 'user' ? 'User' : 'Bot'}: ${m.text}`)
        .slice(-10);

      const context: ChatContext = {
        conversationHistory,
        locale: get().locale,
      };

      const response = await sendChatMessage(messageToRetry.text, context);
      const fullResponse = response.reply;

      const aiMessageId = uuidv4();
      set((state) => ({
        messages: [...state.messages, {
          id: aiMessageId,
          text: '',
          sender: 'ai',
          timestamp: new Date(),
          markdown: true,
          streaming: true,
        }],
      }));

      await streamResponse(aiMessageId, fullResponse);

      set((state) => {
        const newMessages = state.messages.map((m) =>
          m.id === aiMessageId ? { ...m, streaming: false } : m
        );
        return { messages: newMessages, isLoading: false, isStreaming: false };
      });

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry';
      set((state) => ({
        isLoading: false,
        error: { message: errorMessage, retryable: true },
      }));
    }
  },

  loadGreeting: async () => {
    const { messages } = get();
    if (messages.length > 0) return;

    set({ isLoading: true });

    try {
      const greeting = await getGreeting();
      
      const aiMessage: ChatMessage = {
        id: uuidv4(),
        text: '',
        sender: 'ai',
        timestamp: new Date(),
        markdown: true,
        streaming: true,
      };

      set({ messages: [aiMessage] });
      
      await streamResponse(aiMessage.id, greeting);

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === aiMessage.id ? { ...m, streaming: false } : m
        ),
        isLoading: false,
      }));
    } catch (err) {
      console.error('Failed to load greeting:', err);
      set({ isLoading: false });
    }
  },
}));

async function streamResponse(messageId: string, fullText: string): Promise<void> {
  const CHUNK_SIZE = 2;
  const DELAY_MS = 15;

  for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    
    const chunk = fullText.slice(0, i + CHUNK_SIZE);
    useChatbotStore.setState((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, text: chunk } : m
      ),
    }));
  }
}

interface ChatbotContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: ChatErrorState | null;
  quickSuggestions: QuickSuggestion[];
  locale: 'en' | 'mn';
  widgetState: ChatWidgetState;
  conversationTitle: string;
  sendMessage: (text: string) => Promise<void>;
  retryMessage: (id: string) => Promise<void>;
  clearError: () => void;
  setLocale: (locale: 'en' | 'mn') => void;
  setWidgetState: (state: ChatWidgetState) => void;
  setQuickSuggestions: (suggestions: QuickSuggestion[]) => void;
}

const ChatbotContext = createContext<ChatbotContextType | undefined>(undefined);

export const ChatbotProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useChatbotStore();
  
  useEffect(() => {
    if (store.messages.length === 0 && !store.isLoading) {
      store.loadGreeting();
    }
  }, []);

  return (
    <ChatbotContext.Provider value={store}>
      {children}
    </ChatbotContext.Provider>
  );
};

export const useChatbot = () => {
  const context = useContext(ChatbotContext);
  if (context === undefined) {
    throw new Error('useChatbot must be used within a ChatbotProvider');
  }
  return context;
};

export const useChatbotStore2 = useChatbotStore;