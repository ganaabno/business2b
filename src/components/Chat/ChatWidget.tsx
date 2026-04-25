import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatSidebar from './ChatSidebar';

interface ChatWidgetProps {
  currentUser: any;
}

export default function ChatWidget({ currentUser }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-110 z-50"
        >
          <MessageCircle className="w-7 h-7 text-white" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-600 rounded-t-xl">
            <h3 className="text-white font-semibold">Чат</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-blue-700 p-1 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <ChatSidebar currentUser={currentUser} />
        </div>
      )}
    </>
  );
}
