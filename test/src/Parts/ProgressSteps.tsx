import { MapPin, Users, CreditCard } from "lucide-react";

interface ProgressStepsProps {
  activeStep: number;
}

export default function ProgressSteps({ activeStep }: ProgressStepsProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-center space-x-8">
        {[
          { step: 1, title: "Select Tour", icon: MapPin },
          { step: 2, title: "Add Passengers", icon: Users },
          { step: 3, title: "Review & Book", icon: CreditCard }
        ].map(({ step, title, icon: Icon }) => (
          <div key={step} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${activeStep >= step ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-gray-400"}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`ml-2 text-sm font-medium transition-colors ${activeStep >= step ? "text-blue-600" : "text-gray-400"}`}>
              {title}
            </span>
            {step < 3 && (
              <div className={`w-16 h-0.5 ml-4 transition-colors ${activeStep > step ? "bg-blue-600" : "bg-gray-300"}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}