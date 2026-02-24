import { MapPin, User, Users, CreditCard } from "lucide-react";

interface ProgressStepsProps {
  activeStep: number;
}

export default function ProgressSteps({ activeStep }: ProgressStepsProps) {
  return (
    <div className="mono-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {[
          { step: 1, title: "Select Tour", icon: MapPin },
          { step: 2, title: "Lead Passenger", icon: User },
          { step: 3, title: "Add Passengers", icon: Users },
          { step: 4, title: "Review & Book", icon: CreditCard },
        ].map(({ step, title, icon: Icon }) => (
          <div key={step} className="flex items-center gap-3 min-w-[160px]">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
                activeStep >= step
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "border-gray-300 text-gray-400 bg-gray-100"
              }`}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span
              className={`text-sm font-medium transition-colors ${
                activeStep >= step ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
