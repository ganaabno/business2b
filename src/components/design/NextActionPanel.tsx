import React from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';

interface NextActionPanelProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  showIcon?: boolean;
}

export default function NextActionPanel({
  title = 'Next Action Required',
  description,
  actions,
  showIcon = true,
}: NextActionPanelProps) {
  return (
    <div className="next-action-panel">
      <div className="next-action-panel-header">
        {showIcon && (
          <AlertCircle size={20} className="next-action-panel-icon" />
        )}
        <span className="next-action-panel-title">{title}</span>
      </div>
      
      {description && (
        <p className="next-action-panel-description">{description}</p>
      )}
      
      {actions && (
        <div className="next-action-panel-actions">
          {actions}
        </div>
      )}
    </div>
  );
}