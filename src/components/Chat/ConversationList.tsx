import React from 'react';
import { MessageCircle, Plus } from 'lucide-react';

interface Conversation {
  id: string;
  participant: {
    id: string;
    email: string;
    name?: string;
  };
  lastMessage?: {
    content: string;
    created_at: string;
  };
  unreadCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
}: ConversationListProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Өчигдөр';
    } else if (days < 7) {
      return date.toLocaleDateString('mn-MN', { weekday: 'short' });
    }
    return date.toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  const getDisplayName = (email: string, name?: string) => {
    if (name) return name;
    const localPart = email.split('@')[0];
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Шинэ чат
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            Чат олдсонгүй
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
                selectedId === conv.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {getInitials(conv.participant.email)}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {getDisplayName(conv.participant.email, conv.participant.name)}
                  </p>
                  {conv.lastMessage && (
                    <span className="text-xs text-gray-400">
                      {formatTime(conv.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 truncate">
                    {conv.lastMessage?.content || 'Чат эхлээгүй'}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-blue-600 rounded-full">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
