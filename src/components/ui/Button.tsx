import React from 'react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const Button = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  onClick,
  disabled = false,
  type = 'button',
}: ButtonProps) => {
  // Base classes using the mono design system
  const baseClasses =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

  // Variant classes mapped to actual mono CSS variables
  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary:
      'bg-[var(--mono-accent)] text-[var(--mono-accent-contrast)] border border-[var(--mono-accent)] hover:bg-[var(--mono-accent-strong)] hover:border-[var(--mono-accent-strong)] focus-visible:ring-[var(--mono-ring)]',
    secondary:
      'bg-[var(--mono-surface-muted)] text-[var(--mono-text)] border border-[var(--mono-border)] hover:bg-[var(--mono-bg-strong)] hover:border-[var(--mono-border-strong)] focus-visible:ring-[var(--mono-ring)]',
    ghost:
      'bg-transparent text-[var(--mono-text)] border border-transparent hover:bg-[var(--mono-surface-muted)] hover:border-[var(--mono-border)] focus-visible:ring-[var(--mono-ring)]',
    destructive:
      'bg-[var(--mono-danger-bg)] text-[var(--mono-danger-text)] border border-[var(--mono-border)] hover:opacity-90 focus-visible:ring-[var(--mono-ring)]',
  };

  // Size classes
  const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-base',
  };

  const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
};

export default Button;
