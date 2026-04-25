import React from 'react';
import { motion } from 'framer-motion';

const TypingIndicator: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center space-x-1 text-gray-500 text-sm pl-4"
    >
      <span>AI is typing</span>
      <motion.span
        animate={{
          opacity: [0.2, 1, 0.2],
          transition: { duration: 1, repeat: Infinity, ease: "easeInOut" },
        }}
        className="text-2xl leading-none"
      >
        .
      </motion.span>
      <motion.span
        animate={{
          opacity: [0.2, 1, 0.2],
          transition: { delay: 0.2, duration: 1, repeat: Infinity, ease: "easeInOut" },
        }}
        className="text-2xl leading-none"
      >
        .
      </motion.span>
      <motion.span
        animate={{
          opacity: [0.2, 1, 0.2],
          transition: { delay: 0.4, duration: 1, repeat: Infinity, ease: "easeInOut" },
        }}
        className="text-2xl leading-none"
      >
        .
      </motion.span>
    </motion.div>
  );
};

export default TypingIndicator;
