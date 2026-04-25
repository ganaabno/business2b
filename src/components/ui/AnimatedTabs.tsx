import { useState, useEffect, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: number | string;
}

export interface AnimatedTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: "underline" | "pills" | "enclosed";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  showIndicator?: boolean;
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-5 py-3 text-lg",
};

export function AnimatedTabs({
  tabs,
  activeTab,
  onChange,
  variant = "underline",
  size = "md",
  fullWidth = false,
  className = "",
  showIndicator = true,
}: AnimatedTabsProps) {
  const [tabRefs, setTabRefs] = useState<(HTMLButtonElement | null)[]>(new Array(tabs.length).fill(null));
  const [indicatorPosition, setIndicatorPosition] = useState({ left: 0, width: 0 });
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  useEffect(() => {
    const activeTabElement = tabRefs[activeIndex];
    if (activeTabElement) {
      setIndicatorPosition({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      });
    }
  }, [activeIndex, tabRefs]);

  return (
    <div
      className={`relative ${fullWidth ? "flex w-full" : ""} ${className}`}
      role="tablist"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => {
            const newTabRefs = [...tabRefs];
            newTabRefs[index] = el;
            setTabRefs(newTabRefs);
          }}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          className={`
            relative flex items-center justify-center gap-2 font-medium transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mono-accent)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${sizeClasses[size]}
            ${fullWidth ? "flex-1" : ""}
            ${variant === "underline" ? "text-[var(--mono-text-muted)] hover:text-[var(--mono-text)]" : ""}
            ${variant === "pills" ? "rounded-lg text-[var(--mono-text-muted)]" : ""}
            ${variant === "enclosed" ? "rounded-lg text-[var(--mono-text-muted)]" : ""}
            ${tab.id === activeTab ? (variant === "underline" ? "text-[var(--mono-accent)]" : "text-[var(--mono-text)]") : ""}
          `}
          role="tab"
          aria-selected={tab.id === activeTab}
          aria-disabled={tab.disabled}
        >
          {tab.icon && <span className="shrink-0">{tab.icon}</span>}
          <span>{tab.label}</span>
          {tab.badge !== undefined && (
            <span
              className={`
                px-2 py-0.5 text-xs font-medium rounded-full
                ${tab.id === activeTab
                  ? "bg-[var(--mono-accent)] text-white"
                  : "bg-[var(--mono-surface-muted)] text-[var(--mono-text-muted)]"
                }
              `}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}

      {showIndicator && variant === "underline" && (
        <motion.div
          className="absolute bottom-0 h-0.5 bg-[var(--mono-accent)] rounded-full"
          initial={false}
          animate={{
            left: indicatorPosition.left,
            width: indicatorPosition.width,
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      )}

      {showIndicator && variant === "pills" && (
        <motion.div
          className="absolute inset-0 bg-[var(--mono-surface-muted)] rounded-lg -z-10"
          initial={false}
          animate={{
            left: tabRefs[activeIndex]?.offsetLeft,
            width: tabRefs[activeIndex]?.offsetWidth,
            opacity: 1,
          }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        />
      )}
    </div>
  );
}

export interface AnimatedTabContentProps {
  children: ReactNode;
  isActive: boolean;
  id: string;
}

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export function AnimatedTabContent({ children, isActive, id }: AnimatedTabContentProps) {
  return (
    <motion.div
      role="tabpanel"
      id={`tabpanel-${id}`}
      hidden={!isActive}
      variants={contentVariants}
      initial="hidden"
      animate={isActive ? "visible" : "exit"}
      transition={{ duration: 0.2 }}
    >
      {isActive && children}
    </motion.div>
  );
}
