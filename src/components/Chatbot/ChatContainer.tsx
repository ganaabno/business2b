import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ChatHeader from './components/ChatHeader';
import ChatError from './components/ChatError';
import { ChatbotProvider, useChatbot } from './ChatbotContext';

const ChatContainerContent: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { error, clearError } = useChatbot();

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        setScrolled(scrollRef.current.scrollTop > 10);
      }
    };

    const currentRef = scrollRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScroll);
      handleScroll();
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-gradient-to-b from-gray-50 to-white rounded-2xl overflow-hidden border border-gray-200/60 shadow-2xl max-w-[420px] mx-auto my-4 md:my-6 lg:my-8">
      <AnimatePresence mode="wait">
        {error ? (
          <ChatError key="error" error={error} onRetry={clearError} onDismiss={clearError} />
        ) : (
          <React.Fragment key="main">
            <ChatHeader scrolled={scrolled} />
            
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
            >
              <MessageList />
            </div>

            <ChatInput />
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
};

const ChatContainer: React.FC = () => {
  return (
    <ChatbotProvider>
      <div className="h-full w-full flex flex-col bg-transparent">
        <ChatContainerContent />
      </div>
    </ChatbotProvider>
  );
};

export default ChatContainer;