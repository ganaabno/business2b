import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

export interface AnimatedCardProps extends HTMLMotionProps<"div"> {
  children: ReactNode;
  variant?: "default" | "glass" | "elevated" | "section" | "metric";
  hoverEffect?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  /** Optional header title to render a structured section card */
  title?: string;
  /** Optional header right content (e.g. badge or action) */
  headerRight?: ReactNode;
  /** Optional title icon */
  titleIcon?: ReactNode;
  index?: number;
}

const paddingSizes = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export const AnimatedCard = forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      children,
      variant = "default",
      hoverEffect = true,
      padding = "md",
      className = "",
      title,
      headerRight,
      titleIcon,
      index = 0,
      ...props
    },
    ref
  ) => {
    const isSection = variant === "section";
    const isMetric = variant === "metric";

    const baseStyle: React.CSSProperties = isSection
      ? {
          background: 'var(--mono-surface)',
          border: '1.5px solid var(--mono-border)',
          borderRadius: 'var(--mono-radius-lg)',
          boxShadow: '0 2px 12px rgba(29,78,216,0.05)',
          overflow: 'hidden',
        }
      : isMetric
      ? {
          background: 'var(--mono-surface)',
          border: '1.5px solid var(--mono-border)',
          borderRadius: 'var(--mono-radius-lg)',
          overflow: 'hidden',
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={`mono-card ${!isSection && !isMetric ? paddingSizes[padding] : ''} ${className}`}
        style={baseStyle}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.25,
          delay: index * 0.06,
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={
          hoverEffect
            ? { y: -2, boxShadow: '0 6px 20px rgba(29,78,216,0.1)' }
            : undefined
        }
        {...props}
      >
        {(title || headerRight) && (
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{
              borderBottom: '1px solid var(--mono-border)',
              background: 'var(--mono-surface-muted)',
            }}
          >
            <div className="flex items-center gap-2">
              {titleIcon && (
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}
                >
                  {titleIcon}
                </span>
              )}
              {title && (
                <h3
                  className="text-sm font-bold"
                  style={{
                    color: 'var(--mono-text)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {title}
                </h3>
              )}
            </div>
            {headerRight}
          </div>
        )}
        {isSection || isMetric ? (
          <div className={paddingSizes[padding] || 'p-5'}>{children}</div>
        ) : (
          children
        )}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = "AnimatedCard";
