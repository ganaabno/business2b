import React, { useState, useRef, useEffect } from 'react';
import { Send, Calculator, MoreVertical, Phone, Video } from 'lucide-react';
import type { ChatMessage } from '../../types/chat';

interface ChatWindowProps {
  messages: ChatMessage[];
  currentUserId?: string;
  recipientName: string;
  onSend: (content: string) => void;
  onOpenCalculator: () => void;
  loading?: boolean;
}

export default function ChatWindow({
  messages,
  currentUserId,
  recipientName,
  onSend,
  onOpenCalculator,
  loading,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSend(inputValue.trim());
    setInputValue('');
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Өнөөдөр';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Өчигдөр';
    }
    return date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: formatDate(msg.created_at), messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-sm font-medium text-blue-700">
              {recipientName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{recipientName}</h3>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCalculator}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 hover:scale-110 rounded-lg transition-all duration-200"
            title="Тооцоо"
          >
            <Calculator className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 hover:scale-110 rounded-lg transition-all duration-200">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 hover:scale-110 rounded-lg transition-all duration-200">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Ачааллаж байна...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-gray-600 font-medium">Чат эхлээгүй</p>
            <p className="text-gray-500 text-sm mt-1">Эхний зурвасаа илгээгээрэй</p>
          </div>
        ) : (
          messageGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              <div className="flex justify-center my-4">
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>
              {group.messages.map((msg, msgIndex) => {
                const isOwn = msg.sender_id === currentUserId;
                
                return (
                  <div
                    key={msg.id || msgIndex}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
                  >
                    {!isOwn && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0">
                        <span className="text-xs font-medium text-blue-700">
                          {recipientName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                      {msg.message_type === 'price_quote' ? (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                          <div className="text-xs text-green-600 font-medium mb-1">
                            💰 Үнийн санал
                          </div>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`px-4 py-2 rounded-2xl ${
                            isOwn
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                          }`}
                        >
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      )}
                      <span
                        className={`text-xs mt-1 ${
                          isOwn ? 'text-blue-200' : 'text-gray-400'
                        }`}
                      >
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                    
                    {isOwn && (
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ml-2 flex-shrink-0">
                        <span className="text-xs font-medium text-white">
                          {currentUserId?.charAt(0).toUpperCase() || 'Y'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCalculator}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Тооцоо"
          >
            <Calculator className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Зурвас бичнэ үү..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
