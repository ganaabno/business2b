import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { cn } from "../../lib/utils"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, icon, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    
    const variants = {
      primary: "bg-[var(--mono-accent)] text-white hover:bg-[var(--mono-accent-strong)] focus:ring-[var(--mono-ring)] shadow-sm hover:shadow-md",
      secondary: "bg-[var(--mono-surface-muted)] text-[var(--mono-text)] hover:bg-[var(--mono-border)] focus:ring-[var(--mono-ring)]",
      ghost: "text-[var(--mono-text-muted)] hover:bg-[var(--mono-surface-muted)] hover:text-[var(--mono-text)] focus:ring-[var(--mono-ring)]",
      danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
      outline: "border-2 border-[var(--mono-border)] text-[var(--mono-text)] hover:bg-[var(--mono-surface-muted)] focus:ring-[var(--mono-ring)]",
    }
    
    const sizes = {
      sm: "h-8 px-3 text-sm gap-1.5",
      md: "h-10 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2",
    }

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : icon ? (
          <span className="w-4 h-4">{icon}</span>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl border border-[var(--mono-border)] bg-[var(--mono-surface)] p-6",
        "shadow-[var(--mono-shadow-sm)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
Card.displayName = "Card"

export const Badge = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "outline"
}>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-[var(--mono-surface-muted)] text-[var(--mono-text)]",
      success: "bg-emerald-100 text-emerald-700",
      warning: "bg-amber-100 text-amber-700", 
      danger: "bg-red-100 text-red-700",
      outline: "border border-[var(--mono-border)] text-[var(--mono-text)]",
    }
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export const Avatar = forwardRef<HTMLDivElement, { src?: string; name?: string; size?: "sm" | "md" | "lg" }>(
  ({ src, name, size = "md" }, ref) => {
    const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" }
    const initials = name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?"
    
    return (
      <div ref={ref} className={cn("relative rounded-full overflow-hidden bg-[var(--mono-accent)] flex items-center justify-center", sizes[size])}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-white font-medium">{initials}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = "Avatar"

export const Spinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" }
  return (
    <div className={cn("border-2 border-[var(--mono-border)] border-t-[var(--mono-accent)] rounded-full animate-spin", sizes[size])} />
  )
}

export const EmptyState = ({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    {icon && <div className="mb-4 text-[var(--mono-text-soft)]">{icon}</div>}
    <h3 className="text-lg font-semibold text-[var(--mono-text)] mb-1">{title}</h3>
    {description && <p className="text-sm text-[var(--mono-text-soft)] mb-4 max-w-sm">{description}</p>}
    {action}
  </div>
)