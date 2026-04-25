import React from 'react';

type StatusType = 
  | 'pending'
  | 'active'
  | 'approved'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'inactive'
  | 'processing'
  | 'completed'
  | 'default';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge badge--warning' },
  active: { label: 'Active', className: 'badge badge--primary' },
  approved: { label: 'Approved', className: 'badge badge--accent' },
  confirmed: { label: 'Confirmed', className: 'badge badge--accent' },
  completed: { label: 'Completed', className: 'badge badge--accent' },
  rejected: { label: 'Rejected', className: 'badge badge--danger' },
  cancelled: { label: 'Cancelled', className: 'badge badge--danger' },
  inactive: { label: 'Inactive', className: 'badge badge--neutral' },
  processing: { label: 'Processing', className: 'badge badge--info' },
  default: { label: 'Unknown', className: 'badge badge--neutral' },
};

export default function StatusBadge({
  status,
  label,
  showDot = true,
  size = 'md',
}: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || statusConfig.default;
  const displayLabel = label || config.label;

  const dotColors: Record<string, string> = {
    pending: 'var(--color-warning)',
    active: 'var(--color-primary)',
    approved: 'var(--color-accent)',
    confirmed: 'var(--color-accent)',
    completed: 'var(--color-accent)',
    rejected: 'var(--color-danger)',
    cancelled: 'var(--color-danger)',
    inactive: 'var(--color-text-muted)',
    processing: 'var(--color-info)',
  };

  const dotColor = dotColors[status.toLowerCase()] || 'var(--color-text-muted)';
  const dotSize = size === 'sm' ? '6px' : size === 'lg' ? '10px' : '8px';

  return (
    <span className={config.className}>
      {showDot && (
        <span 
          className="status-dot" 
          style={{ 
            width: dotSize, 
            height: dotSize,
            backgroundColor: dotColor,
            flexShrink: 0,
          }} 
        />
      )}
      {displayLabel}
    </span>
  );
}