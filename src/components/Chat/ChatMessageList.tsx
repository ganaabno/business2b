import React from 'react';
import type { ChatMessage } from '../../types/chat';
import { formatMnt } from '../../utils/priceCalculator';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  loading: boolean;
}

export default function ChatMessageList({ messages, currentUserId, loading }: ChatMessageListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500">Ачааллаж байна...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 text-center px-4">
          <p>👋 Сайн байна уу!</p>
          <p className="text-sm mt-2">Та асуултаа бичнэ үү эсвэл тооцоо хэсэг рүү шилжин тооцоо хийгээрэй.</p>
        </div>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => {
        const isOwn = msg.sender_id === currentUserId;
        
        if (msg.message_type === 'price_quote') {
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="text-xs text-green-600 font-medium mb-1">Үнийн санал</div>
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</div>
                <div className="text-xs text-gray-400 mt-1">{formatTime(msg.created_at)}</div>
              </div>
            </div>
          );
        }

        return (
          <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                isOwn
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
