import React from 'react';
import { motion } from 'framer-motion';
import { Bot, ChevronDown, MessageSquare } from 'lucide-react';
import { useChatbot } from '../ChatbotContext';

interface ChatHeaderProps {
  scrolled: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ scrolled }) => {
  const { locale, conversationTitle } = useChatbot();

  return (
    <motion.div
      className={`sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b transition-all duration-300 ${
        scrolled ? 'border-gray-200 shadow-md' : 'border-transparent'
      }`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">
              GTrip AI
            </h2>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              {locale === 'mn' ? 'Онлайн' : 'Online'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title={locale === 'mn' ? 'Шинэ хэлэлцээ' : 'New conversation'}
          >
            <MessageSquare className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatHeader;