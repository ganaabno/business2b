import React from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.22,
  ease: 'easeOut' as const,
};

const PageContainer = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => {
  const location = useLocation();

  return (
    <motion.main
      key={location.pathname}
      className={`flex-1 min-w-0 overflow-y-auto ${className}`}
      style={{
        background: 'var(--mono-bg)',
      }}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      <div className="page-content">
        {children}
      </div>
    </motion.main>
  );
};

export default PageContainer;
