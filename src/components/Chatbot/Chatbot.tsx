import React from 'react';
import ChatContainer from './ChatContainer';

const Chatbot: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 via-gray-50 to-white">
      <ChatContainer />
    </div>
  );
};

export default Chatbot;