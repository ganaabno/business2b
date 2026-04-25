import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, type ReactNode } from "react";

export interface GlowingInputProps extends Omit<HTMLMotionProps<"input">, "ref"> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const GlowingInput = forwardRef<HTMLInputElement, GlowingInputProps>(
  (
    {
      label,
      error,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : ""}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--mono-text-muted)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mono-text-muted)]">
              {leftIcon}
            </div>
          )}
          <motion.input
            ref={ref}
            id={inputId}
            className={`
              mono-input w-full
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              ${error ? "border-red-500 focus:border-red-500 focus:ring-red-200" : ""}
              ${className}
            `}
            aria-invalid={!!error}
            aria-describedby={errorId}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mono-text-muted)]">
              {rightIcon}
            </div>
          )}
          <motion.span
            className="absolute inset-0 rounded-lg pointer-events-none border-2 border-transparent"
            initial={false}
            animate={{
              borderColor: error
                ? "rgba(239, 68, 68, 0.5)"
                : "transparent",
            }}
            transition={{ duration: 0.2 }}
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

GlowingInput.displayName = "GlowingInput";
