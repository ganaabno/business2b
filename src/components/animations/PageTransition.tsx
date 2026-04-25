import { useLocation, type Location } from "react-router-dom";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { type ReactNode, useEffect } from "react";

export interface PageTransitionProps {
  children: ReactNode;
  mode?: "wait" | "sync" | "popLayout";
  animation?: "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "scale" | "none";
  duration?: number;
  showLoadingIndicator?: boolean;
  loadingIndicator?: ReactNode;
}

const pageVariants: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "slide-left": {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  },
  "slide-right": {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 50 },
  },
  "slide-up": {
    initial: { opacity: 0, y: 50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -50 },
  },
  "slide-down": {
    initial: { opacity: 0, y: -50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 50 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.05 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

export function PageTransition({
  children,
  mode = "wait",
  animation = "fade",
  duration = 0.3,
  showLoadingIndicator = false,
  loadingIndicator,
}: PageTransitionProps) {
  const location = useLocation();

  if (animation === "none") {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode={mode}>
      <motion.div
        key={location.pathname}
        variants={pageVariants[animation]}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function usePageTransition() {
  const location = useLocation();
  return location;
}

export { useLocation };
