import React from 'react';
import { Check, Circle } from 'lucide-react';

export interface Step {
  id: string;
  title: string;
  description?: string;
  status: 'completed' | 'active' | 'pending' | 'locked';
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep?: string;
  onStepClick?: (stepId: string) => void;
}

export default function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  const getStepStatus = (step: Step, index: number) => {
    if (step.status) return step.status;
    if (currentStep === step.id) return 'active';
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (currentIndex === -1) return 'pending';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'locked';
  };

  return (
    <div className="workflow-container">
      <div className="workflow-steps">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`workflow-step workflow-step--${status}`}
                onClick={() => status !== 'locked' && onStepClick?.(step.id)}
                style={{ cursor: status !== 'locked' && onStepClick ? 'pointer' : 'default' }}
              >
                <div className="workflow-step-indicator">
                  {status === 'completed' ? (
                    <Check size={18} />
                  ) : status === 'active' ? (
                    <span>{index + 1}</span>
                  ) : status === 'locked' ? (
                    <Circle size={16} className="opacity-50" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="workflow-step-content">
                  <div className="workflow-step-title">{step.title}</div>
                  {step.description && (
                    <div className="workflow-step-description">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div
                  className={`workflow-connector ${
                    status === 'completed' ? 'workflow-connector--completed' : ''
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}