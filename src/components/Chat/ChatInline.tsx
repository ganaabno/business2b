import React from 'react';
import ChatSidebar from './ChatSidebar';

interface ChatInlineProps {
  currentUser: {
    id: string;
    email?: string;
    name?: string;
  } | null;
}

export default function ChatInline({ currentUser }: ChatInlineProps) {
  return (
    <div className="h-full w-full">
      <ChatSidebar currentUser={currentUser} />
    </div>
  );
}
