import React, { useState, useEffect, useRef } from "react";
import { Calculator, MessageCircle, Send, X, User, Bot } from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import PriceCalculator from "./PriceCalculator";
import type { PriceConfig, ChatMessage } from "../../types/chat";
import { fetchPriceConfigs } from "../../api/chat";
import { calculatePrice, formatMnt } from "../../utils/priceCalculator";

interface ChatPanelProps {
  currentUser: any;
  onClose: () => void;
}

interface LocalMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  type: "text" | "price_quote";
  timestamp: Date;
}

export default function ChatPanel({ currentUser, onClose }: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "calculator">("chat");
  const [priceConfigs, setPriceConfigs] = useState<PriceConfig[]>([]);
  const [messages, setMessages] = useState<LocalMessage[]>([
    {
      id: "1",
      content:
        '👋 Сайн байна уу! Би танд тусалж чадна.\n\nТа дараахь зүйлс хийж болно:\n• Аялалын үнэ тооцоолох\n• Захиалгатай холбоотой асуудал асуух\n• Бусад асууritchat\n\n"Тооцоо" товчийг даран тооцооны хэсэг рүү шилжинэ үү.',
      sender: "bot",
      type: "text",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const configs = await fetchPriceConfigs();
        setPriceConfigs(configs);
      } catch (err) {
        console.error("Failed to load price configs:", err);
      }
    };
    loadConfigs();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    const userMessage: LocalMessage = {
      id: Date.now().toString(),
      content,
      sender: "user",
      type: "text",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate bot typing
    setIsTyping(true);

    setTimeout(
      () => {
        const botResponse = generateBotResponse(content);
        setMessages((prev) => [...prev, botResponse]);
        setIsTyping(false);
      },
      1000 + Math.random() * 1000,
    );
  };

  const generateBotResponse = (userInput: string): LocalMessage => {
    const input = userInput.toLowerCase();

    // Check if user wants price calculation
    if (
      input.includes("тооцоо") ||
      input.includes("үнэ") ||
      input.includes("price") ||
      input.includes("тооцоолох")
    ) {
      return {
        id: Date.now().toString(),
        content:
          'Тооцоо хийхийн тулд "Тооцоо" tab руу шилжинэ үү. Тэндээс аялалын үнээ тооцоолох боломжтой.',
        sender: "bot",
        type: "text",
        timestamp: new Date(),
      };
    }

    // Check for greetings
    if (
      input.includes("сайн") ||
      input.includes("hi") ||
      input.includes("hello") ||
      input.includes("sain")
    ) {
      return {
        id: Date.now().toString(),
        content:
          "👋 Сайн байна уу! Би танд тусалж байна. Та юу хийлгэхийг хүсэж байна?",
        sender: "bot",
        type: "text",
        timestamp: new Date(),
      };
    }

    // Check for help requests
    if (
      input.includes("тусал") ||
      input.includes("help") ||
      input.includes("юу хийх") ||
      input.includes("instruction")
    ) {
      return {
        id: Date.now().toString(),
        content:
          'Би дараахь зүйлсэд тусалж чадна:\n\n📊 Тооцоо - Аялалын үнэ тооцоолох\n💬 Чат - Миний асуультай ярих\n❓ Асууritchat - Би танд тусална\n\n"Тооцоо" товчийг даран тооцооны хэсэг рүү шилжигээд үнээ тооцоолоорой.',
        sender: "bot",
        type: "text",
        timestamp: new Date(),
      };
    }

    // Default response
    return {
      id: Date.now().toString(),
      content:
        '🤖 Уучлаарай, би таны асуултыг ойлгоогүй юм. Та дараахь зүйлсээс аль нэгийг сонгоно уу:\n\n📊 Тооцоо - Аялалын үнэ тооцоолох\n❓ Тусламж - Миний боломжтой зүйлс\n\nЭсвэл "Тооцоо" товчийг даран тооцооны хэсэг рүү шилжигээд үнээ тооцоолоорой.',
      sender: "bot",
      type: "text",
      timestamp: new Date(),
    };
  };

  const handlePriceQuote = async (quoteText: string) => {
    const botMessage: LocalMessage = {
      id: Date.now().toString(),
      content: quoteText,
      sender: "bot",
      type: "price_quote",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, botMessage]);
    setActiveTab("chat");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          Чат
        </button>
        <button
          onClick={() => setActiveTab("calculator")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === "calculator"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Calculator className="w-4 h-4" />
          Тооцоо
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender === "bot" && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                      <Bot className="w-4 h-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white"
                        : msg.type === "price_quote"
                          ? "bg-green-50 border border-green-200 text-gray-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.type === "price_quote" && (
                      <div className="text-xs text-green-600 font-medium mb-1">
                        Үнийн санал
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${msg.sender === "user" ? "text-blue-200" : "text-gray-400"}`}
                    >
                      {msg.timestamp.toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {msg.sender === "user" && (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ml-2 flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="bg-gray-100 rounded-lg px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      />
                      <span
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputValue.trim()) {
                  handleSendMessage(inputValue.trim());
                }
              }}
              className="p-3 border-t border-gray-200"
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Зурвас бичнэ үү..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <PriceCalculator
            configs={priceConfigs}
            onSendQuote={handlePriceQuote}
          />
        )}
      </div>
    </div>
  );
}
