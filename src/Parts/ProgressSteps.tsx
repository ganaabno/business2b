import { MapPin, User, Users, CreditCard, Check, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface ProgressStepsProps {
  activeStep: number;
}

type StepState = 'completed' | 'current' | 'locked';

export default function ProgressSteps({ activeStep }: ProgressStepsProps) {
  const { t } = useTranslation();

  const steps = [
    { step: 1, title: t("progressStepSelectTour"), subtitle: "Choose destination", icon: MapPin },
    { step: 2, title: t("progressStepLeadPassenger"), subtitle: "Primary contact", icon: User },
    { step: 3, title: t("progressStepAddPassengers"), subtitle: "All travelers", icon: Users },
    { step: 4, title: t("progressStepReviewBook"), subtitle: "Payment & confirm", icon: CreditCard },
  ];

  const getState = (step: number): StepState => {
    if (step < activeStep) return 'completed';
    if (step === activeStep) return 'current';
    return 'locked';
  };

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: 'var(--mono-surface)',
        border: '1px solid var(--mono-border)',
        boxShadow: '0 1px 4px rgba(29,78,216,0.04)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        {steps.map(({ step, title, subtitle, icon: Icon }, i) => {
          const state = getState(step);
          const isLast = i === steps.length - 1;

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step Item */}
              <div className="flex flex-col items-center flex-shrink-0">
                <motion.div
                  initial={false}
                  animate={
                    state === 'current'
                      ? { scale: [1, 1.1, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.3 }}
                  className="relative"
                >
                  {/* Outer ring for current step */}
                  {state === 'current' && (
                    <div
                      className="absolute inset-0 rounded-full -m-1"
                      style={{
                        border: '2px solid rgba(29,78,216,0.3)',
                        animation: 'pulse 2s infinite',
                      }}
                    />
                  )}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                    style={
                      state === 'completed'
                        ? {
                            background: 'linear-gradient(135deg, #14b8a6, #0f766e)',
                            color: '#fff',
                            boxShadow: '0 2px 8px rgba(20,184,166,0.35)',
                          }
                        : state === 'current'
                        ? {
                            background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
                            color: '#fff',
                            boxShadow: '0 2px 10px rgba(29,78,216,0.4)',
                          }
                        : {
                            background: 'var(--mono-surface-muted)',
                            color: 'var(--mono-text-soft)',
                            border: '2px dashed var(--mono-border-strong)',
                          }
                    }
                  >
                    {state === 'completed' ? (
                      <Check size={16} strokeWidth={3} />
                    ) : state === 'locked' ? (
                      <Lock size={14} />
                    ) : (
                      <Icon size={16} />
                    )}
                  </div>
                </motion.div>

                {/* Step number pill */}
                <span
                  className="mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background:
                      state === 'completed'
                        ? 'rgba(20,184,166,0.1)'
                        : state === 'current'
                        ? 'rgba(29,78,216,0.1)'
                        : 'var(--mono-surface-muted)',
                    color:
                      state === 'completed'
                        ? '#0f766e'
                        : state === 'current'
                        ? '#1d4ed8'
                        : 'var(--mono-text-soft)',
                  }}
                >
                  Step {step}
                </span>

                {/* Step text */}
                <div className="mt-1 text-center hidden sm:block">
                  <p
                    className="text-xs font-semibold leading-tight"
                    style={{
                      color:
                        state === 'completed'
                          ? '#0f766e'
                          : state === 'current'
                          ? 'var(--mono-text)'
                          : 'var(--mono-text-soft)',
                    }}
                  >
                    {title}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: 'var(--mono-text-soft)' }}
                  >
                    {subtitle}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-2 sm:mx-3 relative" style={{ height: '2px', marginTop: '-24px' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background:
                        step < activeStep
                          ? 'linear-gradient(90deg, #14b8a6, #1d4ed8)'
                          : 'var(--mono-border)',
                    }}
                  />
                  {step < activeStep && (
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className="absolute top-0 left-0 h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #14b8a6, #1d4ed8)' }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current step helper text */}
      {activeStep <= 4 && (
        <div
          className="mt-3 pt-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--mono-border)' }}
        >
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{
              background: 'rgba(29,78,216,0.1)',
              color: '#1d4ed8',
            }}
          >
            Current
          </span>
          <p className="text-xs" style={{ color: 'var(--mono-text-muted)' }}>
            {activeStep === 1 && 'Select a tour to continue the booking process'}
            {activeStep === 2 && 'Fill in the lead passenger information'}
            {activeStep === 3 && 'Add all passengers for this booking'}
            {activeStep === 4 && 'Review details and complete your booking'}
          </p>
        </div>
      )}
    </div>
  );
}
