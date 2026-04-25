import React, { useState, useRef } from 'react';
import { useChatbot } from './ChatbotContext';
import { Send, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { QuickSuggestion } from './types';

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const { sendMessage, isLoading, isStreaming, quickSuggestions, setQuickSuggestions, locale } = useChatbot();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSendMessage = () => {
    if (message.trim() && !isLoading && !isStreaming) {
      sendMessage(message);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setQuickSuggestions([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const getSuggestionText = (suggestion: QuickSuggestion): string => {
    return locale === 'mn' ? suggestion.textMn : suggestion.textEn;
  };

  const handleSuggestionClick = (suggestion: QuickSuggestion) => {
    if (!isLoading && !isStreaming) {
      const text = locale === 'mn' ? suggestion.textMn : suggestion.textEn;
      sendMessage(text);
      setQuickSuggestions([]);
    }
  };

  const canSend = message.trim().length > 0 && !isLoading && !isStreaming;

  return (
    <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/80 shadow-lg z-20">
      <AnimatePresence mode="wait">
        {quickSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pt-3 pb-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                {locale === 'mn' ? 'Санал болгох' : 'Suggestions'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.slice(0, 4).map((suggestion) => (
                <motion.button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion)}
                  disabled={isLoading || isStreaming}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-full text-xs font-medium hover:from-blue-100 hover:to-indigo-100 transition-all border border-blue-200/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {getSuggestionText(suggestion)}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 px-4 pb-4">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={locale === 'mn' ? 'Мессеж бичих...' : 'Type a message...'}
            className="w-full p-3 pr-12 rounded-xl border border-gray-200 bg-gray-50/80 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none transition-all text-sm leading-relaxed"
            rows={1}
            disabled={isLoading || isStreaming}
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          
          {isLoading || isStreaming ? (
            <div className="absolute right-3 bottom-3">
              <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : null}
        </div>

        <motion.button
          onClick={handleSendMessage}
          disabled={!canSend}
          className={`flex-shrink-0 p-3 rounded-xl font-medium text-sm transition-all shadow-md ${
            canSend
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          whileHover={canSend ? { scale: 1.02 } : {}}
          whileTap={canSend ? { scale: 0.98 } : {}}
        >
          <Send className={`w-4 h-4 ${canSend ? '' : 'opacity-50'}`} />
        </motion.button>
      </div>
    </div>
  );
};

export default ChatInput;