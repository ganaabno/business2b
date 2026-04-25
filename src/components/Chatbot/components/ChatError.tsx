import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import type { ChatErrorState } from '../types';

interface ChatErrorProps {
  error: ChatErrorState;
  onRetry?: () => void;
  onDismiss?: () => void;
}

const ChatError: React.FC<ChatErrorProps> = ({ error, onRetry, onDismiss }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center h-full p-6"
    >
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <AlertTriangle className="w-7 h-7 text-red-500" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Something went wrong
      </h3>
      
      <p className="text-sm text-gray-600 text-center mb-6">
        {error.message}
      </p>
      
      <div className="flex items-center gap-3">
        {error.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            Try Again
          </button>
        )}
        
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default ChatError;