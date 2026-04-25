import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, TrendingUp, Calendar, Award, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "../supabaseClient";
import type { User as UserType } from "../types/type";

interface ManagerStatsProps {
  currentUser: UserType;
}

interface StatCardProps {
  label: string;
  sublabel: string;
  value: number | string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  trend?: string;
  index: number;
  loading?: boolean;
}

const StatCard = ({
  label,
  sublabel,
  value,
  icon,
  accentColor,
  accentBg,
  accentBorder,
  trend,
  index,
  loading,
}: StatCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: index * 0.07 }}
    className="rounded-xl p-5 relative overflow-hidden"
    style={{
      background: 'var(--mono-surface)',
      border: `1px solid ${accentBorder}`,
      boxShadow: `0 2px 12px ${accentBg}`,
    }}
    whileHover={{ y: -2, boxShadow: `0 6px 20px ${accentBg}` }}
  >
    {/* Background accent blob */}
    <div
      className="absolute top-0 right-0 w-20 h-20 rounded-full -mt-8 -mr-8 opacity-20"
      style={{ background: accentColor }}
    />

    {/* Icon */}
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
      style={{ background: accentBg, color: accentColor }}
    >
      {icon}
    </div>

    {/* Metric */}
    <div className="flex items-end justify-between gap-2">
      <div>
        <p
          className="text-3xl font-bold leading-none mb-1"
          style={{
            color: loading ? 'transparent' : accentColor,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.03em',
            background: loading ? 'var(--mono-border)' : undefined,
            borderRadius: loading ? '4px' : undefined,
            minWidth: loading ? '48px' : undefined,
          }}
        >
          {loading ? '\u00A0\u00A0\u00A0' : value}
        </p>
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--mono-text)' }}
        >
          {label}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: 'var(--mono-text-soft)' }}
        >
          {sublabel}
        </p>
      </div>
      {trend && !loading && (
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-lg"
          style={{
            background: accentBg,
            color: accentColor,
          }}
        >
          {trend}
        </span>
      )}
    </div>
  </motion.div>
);

export default function ManagerStats({ currentUser }: ManagerStatsProps) {
  const [stats, setStats] = useState({
    thisWeek: 0,
    thisMonth: 0,
    threeMonths: 0,
    thisYear: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchManagerStats = async () => {
    if (!currentUser?.id) return;

    try {
      setLoading(true);
      setError(null);
      const now = new Date();

      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfThreeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const [weekRes, monthRes, threeMonthRes, yearRes] = await Promise.all([
        supabase.from("passengers").select("created_at", { count: 'exact', head: true })
          .eq("user_id", currentUser.id).gte("created_at", startOfWeek.toISOString()),
        supabase.from("passengers").select("created_at", { count: 'exact', head: true })
          .eq("user_id", currentUser.id).gte("created_at", startOfMonth.toISOString()),
        supabase.from("passengers").select("created_at", { count: 'exact', head: true })
          .eq("user_id", currentUser.id).gte("created_at", startOfThreeMonthsAgo.toISOString()),
        supabase.from("passengers").select("created_at", { count: 'exact', head: true })
          .eq("user_id", currentUser.id).gte("created_at", startOfYear.toISOString()),
      ]);

      setStats({
        thisWeek: weekRes.count ?? 0,
        thisMonth: monthRes.count ?? 0,
        threeMonths: threeMonthRes.count ?? 0,
        thisYear: yearRes.count ?? 0,
      });
    } catch (err: any) {
      console.error("Failed to fetch manager stats:", err);
      setError("Failed to load statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagerStats();
  }, [currentUser?.id]);

  if (error) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{
          background: 'rgba(239,68,68,0.05)',
          border: '1px solid rgba(239,68,68,0.2)',
        }}
      >
        <AlertCircle size={18} style={{ color: '#dc2626' }} />
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: '#dc2626' }}>
            Failed to load statistics
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-soft)' }}>
            Unable to retrieve passenger data
          </p>
        </div>
        <button
          onClick={fetchManagerStats}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
          style={{
            background: 'rgba(239,68,68,0.1)',
            color: '#dc2626',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  const cards = [
    {
      label: 'This Week',
      sublabel: 'Passengers registered',
      value: stats.thisWeek,
      icon: <Users size={18} />,
      accentColor: '#1d4ed8',
      accentBg: 'rgba(29,78,216,0.08)',
      accentBorder: 'rgba(29,78,216,0.15)',
    },
    {
      label: 'This Month',
      sublabel: 'Passengers registered',
      value: stats.thisMonth,
      icon: <Calendar size={18} />,
      accentColor: '#0f766e',
      accentBg: 'rgba(20,184,166,0.08)',
      accentBorder: 'rgba(20,184,166,0.2)',
      trend: stats.thisMonth > 0 ? `+${stats.thisMonth}` : undefined,
    },
    {
      label: 'Last 3 Months',
      sublabel: 'Passengers registered',
      value: stats.threeMonths,
      icon: <TrendingUp size={18} />,
      accentColor: '#b45309',
      accentBg: 'rgba(245,158,11,0.08)',
      accentBorder: 'rgba(245,158,11,0.2)',
    },
    {
      label: 'This Year',
      sublabel: 'Total passengers',
      value: stats.thisYear,
      icon: <Award size={18} />,
      accentColor: '#7c3aed',
      accentBg: 'rgba(139,92,246,0.08)',
      accentBorder: 'rgba(139,92,246,0.2)',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <StatCard
          key={card.label}
          {...card}
          index={i}
          loading={loading}
        />
      ))}
    </div>
  );
}
