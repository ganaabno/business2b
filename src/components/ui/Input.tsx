import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react"
import { cn } from "../../lib/utils"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="text-sm font-medium text-[var(--mono-text)]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mono-text-soft)]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full h-10 px-3 rounded-xl border border-[var(--mono-border)] bg-[var(--mono-surface)]",
              "text-sm text-[var(--mono-text)] placeholder:text-[var(--mono-text-soft)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--mono-ring)] focus:border-[var(--mono-accent)]",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              icon && "pl-10",
              error && "border-red-500 focus:ring-red-500/20 focus:border-red-500",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }
)

Input.displayName = "Input"