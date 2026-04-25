import React, { useEffect, useRef } from 'react';
import { useChatbot } from './ChatbotContext';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import { motion } from 'framer-motion';

const MessageList: React.FC = () => {
  const { messages, isLoading, isStreaming } = useChatbot();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const renderEmptyState = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        GTrip AI
      </h3>
      <p className="text-sm text-gray-500 max-w-[240px]">
        {typeof window !== 'undefined' && window.navigator.language?.startsWith('mn')
          ? 'Аялалын талаар асуухад танд тусална'
          : 'Ask me anything about your travel plans'}
      </p>
    </motion.div>
  );

  if (messages.length === 0 && !isLoading) {
    return renderEmptyState();
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
      {messages.map((message, index) => (
        <MessageItem
          key={message.id}
          id={message.id}
          text={message.text}
          sender={message.sender}
          timestamp={message.timestamp}
          markdown={message.markdown}
          errored={message.errored}
          streaming={message.streaming}
          isFirst={index === 0}
          tours={message.tours}
          messageType={message.messageType}
        />
      ))}
      {(isLoading || isStreaming) && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;