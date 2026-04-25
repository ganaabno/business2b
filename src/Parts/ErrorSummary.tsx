import { AlertTriangle } from "lucide-react";
import type { ValidationError } from "../types/type";
import { useTranslation } from "react-i18next";

interface ErrorSummaryProps {
  errors: ValidationError[];
}

export default function ErrorSummary({ errors }: ErrorSummaryProps) {
  const { t } = useTranslation();

  return (
    errors.length > 0 && (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center mb-2">
          <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
          <h3 className="text-sm font-medium text-red-800">
            {t("errorSummaryTitle")}
          </h3>
        </div>
        <ul className="text-sm text-red-700 space-y-1">
          {errors.slice(0, 5).map((error, index) => (
            <li key={index}>• {error.message}</li>
          ))}
          {errors.length > 5 && (
            <li className="text-red-600 font-medium">
              {t("errorSummaryMoreErrors", { count: errors.length - 5 })}
            </li>
          )}
        </ul>
      </div>
    )
  );
}
