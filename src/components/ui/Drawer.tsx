import { useEffect, type ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { X } from "lucide-react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  side?: "left" | "right" | "bottom";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  footer?: ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-full",
};

const sideVariants: Record<string, Variants> = {
  right: {
    initial: { x: "100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
  },
  left: {
    initial: { x: "-100%", opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: "-100%", opacity: 0 },
  },
  bottom: {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
  },
};

const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  side = "right",
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer,
}: DrawerProps) {
  useEffect(() => {
    if (isOpen && closeOnEscape) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const isHorizontal = side === "left" || side === "right";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={closeOnOverlayClick ? onClose : undefined}
          />
          <motion.div
            className={`fixed z-50 ${
              side === "right"
                ? "right-0 top-0 h-full border-l"
                : side === "left"
                ? "left-0 top-0 h-full border-r"
                : "bottom-0 left-0 w-full border-t"
            } ${sizeClasses[size]} ${
              isHorizontal ? "h-full" : ""
            } bg-[var(--mono-surface)] shadow-[var(--mono-shadow-lg)]`}
            variants={sideVariants[side]}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex flex-col h-full">
              {(title || showCloseButton) && (
                <div className="flex items-start justify-between gap-4 p-4 border-b">
                  <div>
                    {title && (
                      <h2 className="mono-title text-xl">{title}</h2>
                    )}
                    {description && (
                      <p className="mono-subtitle mt-1 text-sm">
                        {description}
                      </p>
                    )}
                  </div>
                  {showCloseButton && (
                    <button
                      onClick={onClose}
                      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--mono-border)] bg-[var(--mono-surface)] text-[var(--mono-text-muted)] hover:bg-[var(--mono-surface-muted)] hover:text-[var(--mono-text)] transition-colors"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4">{children}</div>

              {footer && (
                <div className="p-4 border-t bg-[var(--mono-surface)]">
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
