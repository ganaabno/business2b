import { motion, type Variants } from "framer-motion";
import { type ReactNode } from "react";

export interface StaggeredListProps {
  children: ReactNode;
  items?: number;
  staggerDelay?: number;
  as?: "ul" | "div";
  className?: string;
}

export function StaggeredList({
  children,
  items,
  staggerDelay = 0.05,
  as: Component = "div",
  className = "",
}: StaggeredListProps) {
  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut",
      },
    },
  };

  if (items) {
    return (
      <motion.div
        className={className}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {Array.from({ length: items }).map((_, i) => (
          <motion.div key={i} variants={itemVariants}>
            <div className="animate-pulse bg-[var(--mono-border)] h-16 rounded-lg" />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export interface StaggeredItemProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function StaggeredItem({
  children,
  delay = 0,
  className = "",
}: StaggeredItemProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut",
        delay,
      },
    },
  };

  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}
