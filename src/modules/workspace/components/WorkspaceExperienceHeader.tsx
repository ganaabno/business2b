import type { ReactNode } from "react";
import type {
  WorkspaceNextAction,
  WorkspaceProgressItem,
} from "../hooks/useWorkspaceProgress";

type WorkspaceMetric = {
  label: string;
  value: string | number;
};

type WorkspaceExperienceHeaderProps = {
  kicker: string;
  title: string;
  subtitle: string;
  workflowLabel: string;
  nextActionLabel?: string;
  badgeLabel?: string | null;
  progressItems: WorkspaceProgressItem[];
  nextAction: WorkspaceNextAction;
  onRunNextAction: () => void;
  metrics: WorkspaceMetric[];
  rightActions?: ReactNode;
};

function progressTone(status: WorkspaceProgressItem["status"]) {
  if (status === "done") {
    return "border-green-300 bg-green-50 text-green-800";
  }
  if (status === "active") {
    return "border-blue-300 bg-blue-50 text-blue-800";
  }
  if (status === "locked") {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }
  return "border-gray-200 bg-gray-50 text-gray-700";
}

export default function WorkspaceExperienceHeader({
  kicker,
  title,
  subtitle,
  workflowLabel,
  nextActionLabel = "Next Action",
  badgeLabel,
  progressItems,
  nextAction,
  onRunNextAction,
  metrics,
  rightActions,
}: WorkspaceExperienceHeaderProps) {
  const visibleMetrics = metrics.slice(0, 3);
  const progressGridColumnsClass =
    progressItems.length >= 4
      ? "xl:grid-cols-4"
      : progressItems.length === 3
        ? "xl:grid-cols-3"
        : "xl:grid-cols-2";

  return (
    <div className="mono-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mono-kicker">{kicker}</p>
          <h2 className="mono-title text-xl mt-1">{title}</h2>
          <p className="mono-subtitle text-sm mt-1">{subtitle}</p>
          {badgeLabel ? (
            <span className="mt-2 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              {badgeLabel}
            </span>
          ) : null}
        </div>

        {rightActions ? <div>{rightActions}</div> : null}
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
              {nextActionLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-indigo-900">
              {nextAction.title}
            </p>
            <p className="mt-1 text-xs text-indigo-800">{nextAction.description}</p>
          </div>

          <button
            type="button"
            onClick={onRunNextAction}
            disabled={Boolean(nextAction.disabled)}
            className="mono-button mono-button--sm disabled:opacity-60"
          >
            {nextAction.ctaLabel}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            {workflowLabel}
          </p>
        </div>

        <div
          className={`mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 ${progressGridColumnsClass}`}
        >
          {progressItems.map((item) => (
            <div
              key={item.key}
              className={`rounded-lg border px-3 py-2 ${progressTone(item.status)}`}
            >
              <p className="text-xs font-semibold">{item.label}</p>
              <p className="mt-1 text-[11px] opacity-90">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {visibleMetrics.map((metric) => (
          <div key={metric.label} className="mono-panel p-3">
            <p className="text-xs text-gray-500">{metric.label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
