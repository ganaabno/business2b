import React from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, Lock, Loader2, HelpCircle } from 'lucide-react';

export type StatusVariant =
  | 'confirmed'
  | 'pending'
  | 'rejected'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'locked'
  | 'active'
  | 'inactive'
  | 'approved'
  | 'declined'
  | 'waiting'
  | 'paid'
  | 'unpaid'
  | 'draft'
  | 'review'
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

interface StatusConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  icon?: React.ReactNode;
  label?: string;
}

const STATUS_CONFIG: Record<StatusVariant, StatusConfig> = {
  confirmed: {
    bg: 'rgba(20,184,166,0.1)',
    text: '#0f766e',
    border: 'rgba(20,184,166,0.3)',
    dot: '#14b8a6',
    icon: <CheckCircle size={11} />,
    label: 'Confirmed',
  },
  approved: {
    bg: 'rgba(20,184,166,0.1)',
    text: '#0f766e',
    border: 'rgba(20,184,166,0.3)',
    dot: '#14b8a6',
    icon: <CheckCircle size={11} />,
    label: 'Approved',
  },
  completed: {
    bg: 'rgba(29,78,216,0.08)',
    text: '#1d4ed8',
    border: 'rgba(29,78,216,0.2)',
    dot: '#3b82f6',
    icon: <CheckCircle size={11} />,
    label: 'Completed',
  },
  success: {
    bg: 'rgba(20,184,166,0.1)',
    text: '#0f766e',
    border: 'rgba(20,184,166,0.3)',
    dot: '#14b8a6',
    icon: <CheckCircle size={11} />,
    label: 'Success',
  },
  paid: {
    bg: 'rgba(5,150,105,0.1)',
    text: '#065f46',
    border: 'rgba(5,150,105,0.25)',
    dot: '#059669',
    icon: <CheckCircle size={11} />,
    label: 'Paid',
  },
  active: {
    bg: 'rgba(14,165,233,0.1)',
    text: '#0369a1',
    border: 'rgba(14,165,233,0.25)',
    dot: '#0ea5e9',
    icon: <CheckCircle size={11} />,
    label: 'Active',
  },
  pending: {
    bg: 'rgba(245,158,11,0.1)',
    text: '#b45309',
    border: 'rgba(245,158,11,0.25)',
    dot: '#f59e0b',
    icon: <Clock size={11} />,
    label: 'Pending',
  },
  waiting: {
    bg: 'rgba(245,158,11,0.1)',
    text: '#b45309',
    border: 'rgba(245,158,11,0.25)',
    dot: '#f59e0b',
    icon: <Clock size={11} />,
    label: 'Waiting',
  },
  review: {
    bg: 'rgba(139,92,246,0.1)',
    text: '#7c3aed',
    border: 'rgba(139,92,246,0.25)',
    dot: '#8b5cf6',
    icon: <AlertCircle size={11} />,
    label: 'In Review',
  },
  processing: {
    bg: 'rgba(29,78,216,0.08)',
    text: '#1d4ed8',
    border: 'rgba(29,78,216,0.2)',
    dot: '#3b82f6',
    icon: <Loader2 size={11} className="animate-spin" />,
    label: 'Processing',
  },
  info: {
    bg: 'rgba(29,78,216,0.08)',
    text: '#1d4ed8',
    border: 'rgba(29,78,216,0.2)',
    dot: '#3b82f6',
    icon: <AlertCircle size={11} />,
    label: 'Info',
  },
  draft: {
    bg: 'rgba(100,116,139,0.1)',
    text: '#475569',
    border: 'rgba(100,116,139,0.2)',
    dot: '#94a3b8',
    label: 'Draft',
  },
  inactive: {
    bg: 'rgba(100,116,139,0.1)',
    text: '#64748b',
    border: 'rgba(100,116,139,0.2)',
    dot: '#94a3b8',
    label: 'Inactive',
  },
  unpaid: {
    bg: 'rgba(100,116,139,0.1)',
    text: '#475569',
    border: 'rgba(100,116,139,0.2)',
    dot: '#94a3b8',
    label: 'Unpaid',
  },
  rejected: {
    bg: 'rgba(239,68,68,0.08)',
    text: '#dc2626',
    border: 'rgba(239,68,68,0.2)',
    dot: '#ef4444',
    icon: <XCircle size={11} />,
    label: 'Rejected',
  },
  declined: {
    bg: 'rgba(239,68,68,0.08)',
    text: '#dc2626',
    border: 'rgba(239,68,68,0.2)',
    dot: '#ef4444',
    icon: <XCircle size={11} />,
    label: 'Declined',
  },
  cancelled: {
    bg: 'rgba(239,68,68,0.08)',
    text: '#dc2626',
    border: 'rgba(239,68,68,0.2)',
    dot: '#ef4444',
    icon: <XCircle size={11} />,
    label: 'Cancelled',
  },
  error: {
    bg: 'rgba(239,68,68,0.08)',
    text: '#dc2626',
    border: 'rgba(239,68,68,0.2)',
    dot: '#ef4444',
    icon: <XCircle size={11} />,
    label: 'Error',
  },
  locked: {
    bg: 'rgba(100,116,139,0.08)',
    text: '#64748b',
    border: 'rgba(100,116,139,0.15)',
    dot: '#94a3b8',
    icon: <Lock size={11} />,
    label: 'Locked',
  },
  warning: {
    bg: 'rgba(245,158,11,0.1)',
    text: '#b45309',
    border: 'rgba(245,158,11,0.25)',
    dot: '#f59e0b',
    icon: <AlertCircle size={11} />,
    label: 'Warning',
  },
};

const normalizeStatus = (status: string): StatusVariant => {
  const lower = status.toLowerCase().trim();
  if (lower in STATUS_CONFIG) return lower as StatusVariant;
  if (lower === 'paid' || lower === 'success') return 'confirmed';
  if (lower === 'failed' || lower === 'refused') return 'rejected';
  if (lower === 'in_progress' || lower === 'processing') return 'processing';
  if (lower === 'waiting' || lower === 'hold') return 'waiting';
  return 'pending';
};

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  showDot?: boolean;
  className?: string;
}

const StatusBadge = ({
  status,
  label,
  size = 'sm',
  showIcon = true,
  showDot = false,
  className = '',
}: StatusBadgeProps) => {
  const variant = normalizeStatus(status);
  const config = STATUS_CONFIG[variant];
  const displayLabel = label ?? config.label ?? status;

  const sizeClasses: Record<string, string> = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-1',
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-sm px-2.5 py-1 gap-2',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full leading-none whitespace-nowrap ${sizeClasses[size]} ${className}`}
      style={{
        background: config.bg,
        color: config.text,
        border: `1px solid ${config.border}`,
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: config.dot }}
        />
      )}
      {showIcon && config.icon && !showDot && (
        <span className="shrink-0">{config.icon}</span>
      )}
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
