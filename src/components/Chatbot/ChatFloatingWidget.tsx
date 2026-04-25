import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Minimize2 } from "lucide-react";
import { useChatbot } from "./ChatbotContext";
import ChatContainer from "./ChatContainer";
import type { ChatWidgetState } from "./types";

const ChatFloatingWidget: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const { messages, isLoading, isStreaming } = useChatbot();

  useEffect(() => {
    if (messages.length > 0 && (isLoading || isStreaming)) {
      setShowBadge(true);
    }
  }, [messages.length, isLoading, isStreaming]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setShowBadge(false);
    }
  };

  if (isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-4 right-4 w-[380px] h-[560px] md:h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200/60 overflow-hidden z-50"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">GTrip AI</h3>
                <p className="text-xs text-blue-100">
                  {isLoading || isStreaming ? "Thinking..." : "Online"}
                </p>
              </div>
            </div>
            <button
              onClick={toggleExpand}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatContainer />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-4 right-4 z-40"
    >
      <motion.button
        onClick={toggleExpand}
        className="relative w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageSquare className="w-6 h-6" />

        <AnimatePresence>
          {showBadge && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
            />
          )}
        </AnimatePresence>

        <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full" />
      </motion.button>
    </motion.div>
  );
};

export default ChatFloatingWidget;
