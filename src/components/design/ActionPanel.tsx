import React from 'react';
import { AlertCircle, CheckCircle, ArrowRight, Clock } from 'lucide-react';

interface ActionItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  type: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

interface ActionPanelProps {
  title?: string;
  description?: string;
  items: ActionItem[];
  onAction: (id: string) => void;
  variant?: 'buttons' | 'list' | 'cards';
  showNextAction?: boolean;
  nextActionLabel?: string;
}

export default function ActionPanel({
  title,
  description,
  items,
  onAction,
  variant = 'buttons',
  showNextAction = false,
  nextActionLabel = 'Continue',
}: ActionPanelProps) {
  const renderButton = (item: ActionItem) => {
    const baseClasses = 'btn';
    const typeClasses = {
      primary: 'btn--primary',
      secondary: 'btn--secondary',
      danger: 'btn--danger',
      ghost: 'btn--ghost',
    };

    return (
      <button
        key={item.id}
        onClick={() => onAction(item.id)}
        disabled={item.disabled || item.loading}
        className={`${baseClasses} ${typeClasses[item.type]} w-full justify-start`}
      >
        {item.icon && <span className="mr-2">{item.icon}</span>}
        {item.label}
        {item.loading && (
          <span className="ml-2 animate-spin">
            <Clock size={14} />
          </span>
        )}
      </button>
    );
  };

  const renderListItem = (item: ActionItem) => {
    return (
      <button
        key={item.id}
        onClick={() => onAction(item.id)}
        disabled={item.disabled || item.loading}
        className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors text-left"
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            item.type === 'primary'
              ? 'bg-blue-100 text-blue-600'
              : item.type === 'danger'
              ? 'bg-red-100 text-red-600'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {item.icon || <ArrowRight size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900">{item.label}</div>
          {item.description && (
            <div className="text-sm text-gray-500">{item.description}</div>
          )}
        </div>
        <ArrowRight size={16} className="text-gray-400" />
      </button>
    );
  };

  const renderCard = (item: ActionItem) => {
    return (
      <div
        key={item.id}
        className={`p-4 rounded-lg border transition-colors ${
          item.type === 'primary'
            ? 'border-blue-200 bg-blue-50'
            : item.type === 'danger'
            ? 'border-red-200 bg-red-50'
            : 'border-gray-200 bg-white'
        }`}
      >
        <button
          onClick={() => onAction(item.id)}
          disabled={item.disabled || item.loading}
          className="w-full text-left"
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                item.type === 'primary'
                  ? 'bg-blue-500 text-white'
                  : item.type === 'danger'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-500 text-white'
              }`}
            >
              {item.icon || <ArrowRight size={18} />}
            </div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{item.label}</div>
              {item.description && (
                <div className="text-sm text-gray-500 mt-1">{item.description}</div>
              )}
            </div>
          </div>
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {variant === 'buttons' && items.map(renderButton)}
        {variant === 'list' && items.map(renderListItem)}
        {variant === 'cards' && items.map(renderCard)}
      </div>

      {/* Next Action Indicator */}
      {showNextAction && (
        <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
          <CheckCircle size={14} className="text-green-500" />
          <span>{nextActionLabel}</span>
          <ArrowRight size={14} className="ml-auto" />
        </div>
      )}
    </div>
  );
}