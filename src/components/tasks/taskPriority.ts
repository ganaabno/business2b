export type TaskPriorityVisual = {
  label: string;
  rank: number;
  badgeClassName: string;
  dotClassName: string;
};

const FALLBACK_PRIORITY_VISUAL: TaskPriorityVisual = {
  label: "Unknown",
  rank: 5,
  badgeClassName: "border-gray-200 bg-gray-100 text-gray-700",
  dotClassName: "bg-gray-400",
};

const PRIORITY_VISUALS: Record<string, TaskPriorityVisual> = {
  low: {
    label: "Low",
    rank: 3,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  medium: {
    label: "Medium",
    rank: 2,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  high: {
    label: "High",
    rank: 1,
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    dotClassName: "bg-red-500",
  },
  urgent: {
    label: "Urgent",
    rank: 0,
    badgeClassName: "border-rose-300 bg-rose-100 text-rose-800",
    dotClassName: "bg-rose-600",
  },
};

export function getTaskPriorityVisual(priority: string | null | undefined) {
  const key = String(priority || "")
    .trim()
    .toLowerCase();

  return PRIORITY_VISUALS[key] || FALLBACK_PRIORITY_VISUAL;
}

export function getTaskPriorityRank(priority: string | null | undefined) {
  return getTaskPriorityVisual(priority).rank;
}
