import { motion, type HTMLMotionProps, type Variants, type Transition } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

export interface MotionWrapperProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  animation?: "fade" | "slide" | "scale" | "rise" | "none";
  delay?: number;
  duration?: number;
}

const animations: Record<string, Variants> = {
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  slide: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
  rise: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  none: {
    hidden: {},
    visible: {},
  },
};

export const MotionWrapper = forwardRef<HTMLDivElement, MotionWrapperProps>(
  (
    {
      children,
      animation = "fade",
      delay = 0,
      duration,
      className = "",
      ...props
    },
    ref
  ) => {
    const defaultDuration = 0.3;
    const transition: Transition = duration
      ? { duration }
      : { duration: defaultDuration, ease: "easeOut" };

    return (
      <motion.div
        ref={ref}
        className={className}
        variants={animations[animation]}
        initial="hidden"
        animate="visible"
        transition={{ ...transition, delay }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

MotionWrapper.displayName = "MotionWrapper";

export const fadeIn = (delay = 0, duration = 0.3) => ({
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  transition: { delay, duration, ease: "easeOut" } as Transition,
});

export const slideUp = (delay = 0, duration = 0.3) => ({
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  transition: { delay, duration, ease: "easeOut" } as Transition,
});

export const slideDown = (delay = 0, duration = 0.3) => ({
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  transition: { delay, duration, ease: "easeOut" } as Transition,
});

export const scaleIn = (delay = 0, duration = 0.3) => ({
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  transition: { delay, duration, ease: "easeOut" } as Transition,
});

export const riseUp = (delay = 0, duration = 0.42) => ({
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
  transition: { delay, duration, ease: "easeOut" } as Transition,
});

export const staggerContainer = (delay = 0.05) => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: delay,
      delayChildren: delay,
    },
  },
});

export const staggerItem = (delay = 0) => ({
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut", delay },
  },
});
