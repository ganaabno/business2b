import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatbot } from './ChatbotContext';
import ReactMarkdown from 'react-markdown';
import { Clipboard, RefreshCw, Check, Copy, Bot, User, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import type { TourResult } from './types';
import TourResultCard from './components/TourResultCard';

interface MessageItemProps {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  markdown?: boolean;
  errored?: boolean;
  streaming?: boolean;
  isFirst?: boolean;
  tours?: TourResult[];
  messageType?: 'tour_results' | 'conversation';
  isAIGenerative?: boolean;
  intentType?: 'cheapest' | 'recommend' | 'best' | 'general';
}

const MessageItem: React.FC<MessageItemProps> = ({
  id,
  text,
  sender,
  timestamp,
  markdown,
  errored,
  streaming,
  isFirst,
  tours,
  messageType,
  isAIGenerative,
  intentType,
}) => {
  const { retryMessage, locale } = useChatbot();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    retryMessage(id);
  };

  const formatTimestamp = (date: Date) => {
    try {
      return format(new Date(date), 'HH:mm');
    } catch {
      return '00:00';
    }
  };

  const handleSelectTour = (tour: TourResult) => {
    console.log('Selected tour:', tour);
  };

  const isUser = sender === 'ai';

  // Show tour results if available
  const showTours = tours && tours.length > 0 && messageType === 'tour_results';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex items-end gap-2 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 relative">
          <motion.div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Bot className="w-4 h-4 text-white" />
          </motion.div>
          {isAIGenerative && (
            <motion.div
              className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              title="AI Powered"
            >
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </motion.div>
          )}
        </div>
      )}

      <div className={`relative max-w-[80%] ${isUser ? 'order-1' : ''}`}>
        <motion.div
          className={`relative px-4 py-3 rounded-2xl shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
          } ${errored ? 'bg-red-50 border-red-200 text-red-800' : ''}`}
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
        >
          {/* Tour Results Display */}
          {showTours ? (
            <TourResultCard 
              tours={tours} 
              onSelectTour={handleSelectTour}
              locale={locale}
            />
          ) : (
            /* Normal text/markdown */
            <>
              {markdown && !errored ? (
                <div className="prose prose-sm max-w-none prose-blue">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto text-xs my-2">
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        ) : (
                          <code
                            className={`px-1.5 py-0.5 rounded ${
                              isUser ? 'bg-blue-800 text-blue-100' : 'bg-gray-100 text-gray-800'
                            } text-xs font-mono`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      },
                      ul({ children }) {
                        return <ul className="my-2 space-y-1">{children}</ul>;
                      },
                      ol({ children }) {
                        return <ol className="my-2 space-y-1 list-decimal list-inside">{children}</ol>;
                      },
                      li({ children }) {
                        return <li className="ml-2">{children}</li>;
                      },
                    }}
                  >
                    {text || (streaming ? '...' : '')}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
              )}

              <div
                className={`text-[11px] mt-1.5 flex items-center gap-1 ${
                  isUser ? 'text-blue-200' : 'text-gray-400'
                }`}
              >
                {streaming && (
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                )}
                {formatTimestamp(timestamp)}
              </div>
            </>
          )}

          {/* Copy Button */}
          {!isUser && !errored && !showTours && (
            <AnimatePresence>
              <motion.button
                onClick={handleCopy}
                className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="Copy"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                )}
              </motion.button>
            </AnimatePresence>
          )}

          {/* Retry Button */}
          {errored && (
            <motion.button
              onClick={handleRetry}
              className="absolute -bottom-2.5 -right-2.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              title="Retry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </motion.div>
      </div>

      {isUser && (
        <motion.div
          className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <User className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </motion.div>
  );
};

export default MessageItem;