import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, AlertCircle, CheckCircle, Clock, Zap, X } from 'lucide-react';

export type ActionPriority = 'high' | 'medium' | 'low' | 'success' | 'info';

export interface NextAction {
  id: string;
  title: string;
  description?: string;
  priority: ActionPriority;
  actionLabel?: string;
  onAction?: () => void;
  dismissable?: boolean;
  onDismiss?: () => void;
}

interface NextActionPanelProps {
  actions: NextAction[];
  title?: string;
  className?: string;
  compact?: boolean;
}

const PRIORITY_CONFIG: Record<ActionPriority, {
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
  icon: React.ReactNode;
  actionBg: string;
  actionText: string;
  pill: string;
  pillText: string;
  label: string;
}> = {
  high: {
    bg: 'rgba(239,68,68,0.04)',
    border: 'rgba(239,68,68,0.25)',
    iconColor: '#dc2626',
    titleColor: '#dc2626',
    icon: <AlertCircle size={16} />,
    actionBg: '#dc2626',
    actionText: '#fff',
    pill: 'rgba(239,68,68,0.12)',
    pillText: '#dc2626',
    label: 'Action Required',
  },
  medium: {
    bg: 'rgba(245,158,11,0.05)',
    border: 'rgba(245,158,11,0.3)',
    iconColor: '#d97706',
    titleColor: '#92400e',
    icon: <Clock size={16} />,
    actionBg: '#d97706',
    actionText: '#fff',
    pill: 'rgba(245,158,11,0.12)',
    pillText: '#b45309',
    label: 'Attention',
  },
  low: {
    bg: 'rgba(29,78,216,0.04)',
    border: 'rgba(29,78,216,0.18)',
    iconColor: '#1d4ed8',
    titleColor: '#1e3a8a',
    icon: <Zap size={16} />,
    actionBg: '#1d4ed8',
    actionText: '#fff',
    pill: 'rgba(29,78,216,0.1)',
    pillText: '#1d4ed8',
    label: 'Next Step',
  },
  success: {
    bg: 'rgba(20,184,166,0.05)',
    border: 'rgba(20,184,166,0.25)',
    iconColor: '#0f766e',
    titleColor: '#0f766e',
    icon: <CheckCircle size={16} />,
    actionBg: '#0f766e',
    actionText: '#fff',
    pill: 'rgba(20,184,166,0.1)',
    pillText: '#0f766e',
    label: 'Completed',
  },
  info: {
    bg: 'rgba(14,165,233,0.04)',
    border: 'rgba(14,165,233,0.2)',
    iconColor: '#0284c7',
    titleColor: '#0369a1',
    icon: <AlertCircle size={16} />,
    actionBg: '#0284c7',
    actionText: '#fff',
    pill: 'rgba(14,165,233,0.1)',
    pillText: '#0284c7',
    label: 'Info',
  },
};

const ActionItem = ({
  action,
  compact,
}: {
  action: NextAction;
  compact?: boolean;
}) => {
  const config = PRIORITY_CONFIG[action.priority];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 ${compact ? 'p-3' : 'p-4'} rounded-xl`}
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      <div style={{ color: config.iconColor, marginTop: '1px', flexShrink: 0 }}>
        {config.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: config.pill, color: config.pillText }}
          >
            {config.label}
          </span>
        </div>
        <p
          className="text-sm font-semibold leading-tight"
          style={{ color: config.titleColor }}
        >
          {action.title}
        </p>
        {action.description && !compact && (
          <p
            className="text-xs mt-1 leading-relaxed"
            style={{ color: 'var(--mono-text-muted)' }}
          >
            {action.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {action.onAction && action.actionLabel && (
          <button
            onClick={action.onAction}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
            style={{
              background: config.actionBg,
              color: config.actionText,
              boxShadow: `0 2px 8px ${config.border}`,
            }}
          >
            {action.actionLabel}
            <ArrowRight size={12} />
          </button>
        )}
        {action.dismissable && action.onDismiss && (
          <button
            onClick={action.onDismiss}
            className="p-1 rounded-lg transition-all"
            style={{ color: 'var(--mono-text-soft)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const NextActionPanel = ({
  actions,
  title = 'Next Actions',
  className = '',
  compact = false,
}: NextActionPanelProps) => {
  if (actions.length === 0) return null;

  const highPriority = actions.filter((a) => a.priority === 'high');
  const others = actions.filter((a) => a.priority !== 'high');
  const sorted = [...highPriority, ...others];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl overflow-hidden ${className}`}
      style={{
        background: 'var(--mono-surface)',
        border: '1px solid var(--mono-border)',
        boxShadow: '0 2px 12px rgba(29,78,216,0.06)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--mono-border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)' }}
          >
            <Zap size={12} className="text-white" />
          </div>
          <h3
            className="text-sm font-bold"
            style={{ color: 'var(--mono-text)', letterSpacing: '-0.01em' }}
          >
            {title}
          </h3>
        </div>
        {actions.length > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{
              background: highPriority.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(29,78,216,0.08)',
              color: highPriority.length > 0 ? '#dc2626' : '#1d4ed8',
            }}
          >
            {actions.length} item{actions.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Action Items */}
      <div className={`${compact ? 'p-2' : 'p-3'} space-y-2`}>
        {sorted.map((action) => (
          <ActionItem key={action.id} action={action} compact={compact} />
        ))}
      </div>
    </motion.div>
  );
};

export default NextActionPanel;
