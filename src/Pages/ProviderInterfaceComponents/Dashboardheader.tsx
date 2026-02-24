import { FileText, Calendar, Users, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function DashboardHeader() {
  const { t } = useTranslation();

  return (
    <div className="mono-card p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gray-100 rounded-2xl border border-gray-200">
            <FileText className="w-6 h-6 text-gray-700" />
          </div>
          <div className="mono-stack-tight">
            <p className="mono-kicker">Provider</p>
            <h1 className="mono-title text-2xl sm:text-3xl">
              {t("dashboardTitle")}
            </h1>
            <p className="mono-subtitle text-sm sm:text-base max-w-2xl">
              {t("dashboardSubtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="mono-badge">
            <Calendar className="w-4 h-4" />
            {t("today")}
          </span>
          <span className="mono-badge">
            <Users className="w-4 h-4" />
            {t("activeTours")}
          </span>
          <span className="mono-badge">
            <TrendingUp className="w-4 h-4" />
            {t("growing")}
          </span>
        </div>
      </div>
    </div>
  );
}
