import type { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const variantClasses = {
    text: "rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-pulse",
    none: "",
  };

  return (
    <div
      className={`bg-[var(--mono-border)] ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          height={16}
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  className = "",
  showImage = true,
  lines = 3,
}: {
  className?: string;
  showImage?: boolean;
  lines?: number;
}) {
  return (
    <div className={`mono-card p-4 ${className}`}>
      {showImage && (
        <Skeleton variant="rectangular" height={160} className="mb-4" />
      )}
      <Skeleton variant="text" height={24} width="70%" className="mb-2" />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = "",
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={`mono-table-shell ${className}`}>
      <div className="mono-table-scroll">
        <table className="mono-table">
          <thead>
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i}>
                  <Skeleton variant="text" height={16} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex}>
                    <Skeleton variant="text" height={14} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SkeletonButton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Skeleton
      variant="rectangular"
      height={40}
      width={120}
      className={className}
    />
  );
}

export function SkeletonAvatar({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: 32,
    md: 40,
    lg: 56,
  };

  return (
    <Skeleton
      variant="circular"
      width={sizes[size]}
      height={sizes[size]}
      className={className}
    />
  );
}

export function SkeletonInput({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <Skeleton variant="text" height={14} width={80} className="mb-1.5" />
      <Skeleton variant="rectangular" height={44} />
    </div>
  );
}

export function SkeletonList({
  count = 3,
  className = "",
  renderItem,
}: {
  count?: number;
  className?: string;
  renderItem?: () => ReactNode;
}) {
  if (renderItem) {
    return <div className={className}>{Array.from({ length: count }).map((_, i) => <div key={i}>{renderItem()}</div>)}</div>;
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonAvatar size="sm" />
          <div className="flex-1">
            <Skeleton variant="text" height={14} width="30%" className="mb-1" />
            <Skeleton variant="text" height={12} width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonForm({
  fields = 4,
  className = "",
}: {
  fields?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <SkeletonInput key={i} />
      ))}
    </div>
  );
}

export function LoadingOverlay({
  isLoading,
  children,
}: {
  isLoading: boolean;
  children: ReactNode;
}) {
  if (!isLoading) return <>{children}</>;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-[var(--mono-surface)]/80 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[var(--mono-border)] border-solid rounded-full animate-spin border-t-[var(--mono-accent)]" />
          <span className="text-sm text-[var(--mono-text-muted)]">Loading...</span>
        </div>
      </div>
      {children}
    </div>
  );
}
