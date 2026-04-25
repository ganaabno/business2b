import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
    label?: string;
  };
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}

export default function KpiCard({
  label,
  value,
  change,
  icon,
  trend,
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="card kpi-card">
        <div className="skeleton skeleton-text w-24 mb-2" />
        <div className="skeleton skeleton-title w-32" />
      </div>
    );
  }

  const changeType = change?.type || trend;
  const isPositive = changeType === "increase" || changeType === "up";
  const isNegative = changeType === "decrease" || changeType === "down";

  return (
    <div className="card kpi-card">
      <div className="flex items-start justify-between mb-3">
        <div className="skeleton skeleton-text">{label}</div>
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
            {icon}
          </div>
        )}
      </div>

      <div className="text-3xl font-semibold tracking-tight text-gray-900 mb-2">
        {value}
      </div>
      {change && (
        <div
          className={`kpi-change ${
            isPositive ? "kpi-change--up" : isNegative ? "kpi-change--down" : ""
          }`}
        >
          {isPositive ? (
            <TrendingUp size={14} />
          ) : isNegative ? (
            <TrendingDown size={14} />
          ) : null}
          <span>
            {isPositive && "+"}
            {change.value}%
          </span>
          {change.label && (
            <span className="text-gray-500 ml-1">{change.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
