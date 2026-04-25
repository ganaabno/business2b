import { motion } from "framer-motion";
import {
  FileText,
  Users,
  MapPin,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import type { Order } from "../types/type";

interface AdminOverviewProps {
  orders: Order[];
}

const MetricCard = ({
  label,
  value,
  sublabel,
  icon,
  accentColor,
  accentBg,
  accentBorder,
  index,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -2 }}
    className="rounded-xl p-5 relative overflow-hidden"
    style={{
      background: 'var(--mono-surface)',
      border: `1.5px solid ${accentBorder}`,
      boxShadow: `0 2px 14px ${accentBg}`,
    }}
  >
    {/* Background blob */}
    <div
      className="absolute top-0 right-0 w-24 h-24 rounded-full -mt-10 -mr-10 opacity-15"
      style={{ background: accentColor }}
    />

    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
      style={{ background: accentBg, color: accentColor }}
    >
      {icon}
    </div>

    <p
      className="text-3xl font-bold leading-none mb-1"
      style={{
        color: accentColor,
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.04em',
      }}
    >
      {value}
    </p>
    <p className="text-sm font-semibold" style={{ color: 'var(--mono-text)' }}>
      {label}
    </p>
    {sublabel && (
      <p className="text-xs mt-0.5" style={{ color: 'var(--mono-text-soft)' }}>
        {sublabel}
      </p>
    )}
  </motion.div>
);

export default function AdminOverview({ orders }: AdminOverviewProps) {
  const totalPassengers = orders.reduce(
    (sum, order) => sum + (order.passengers?.length || 0),
    0,
  );
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.total_price || 0),
    0,
  );
  const confirmedOrders = orders.filter(
    (o) => o.status === "confirmed",
  ).length;
  const pendingOrders = orders.filter((o) => o.status === "pending").length;

  const metrics = [
    {
      label: 'Total Bookings',
      value: orders.length,
      sublabel: `${confirmedOrders} confirmed`,
      icon: <FileText size={18} />,
      accentColor: '#1d4ed8',
      accentBg: 'rgba(29,78,216,0.08)',
      accentBorder: 'rgba(29,78,216,0.18)',
    },
    {
      label: 'Total Passengers',
      value: totalPassengers,
      sublabel: 'All bookings',
      icon: <Users size={18} />,
      accentColor: '#0f766e',
      accentBg: 'rgba(20,184,166,0.08)',
      accentBorder: 'rgba(20,184,166,0.2)',
    },
    {
      label: 'Pending Review',
      value: pendingOrders,
      sublabel: pendingOrders > 0 ? 'Needs attention' : 'All clear',
      icon: pendingOrders > 0 ? <AlertTriangle size={18} /> : <CheckCircle size={18} />,
      accentColor: pendingOrders > 0 ? '#b45309' : '#0f766e',
      accentBg: pendingOrders > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(20,184,166,0.08)',
      accentBorder: pendingOrders > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(20,184,166,0.2)',
    },
    {
      label: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      sublabel: 'Gross across all orders',
      icon: <DollarSign size={18} />,
      accentColor: '#7c3aed',
      accentBg: 'rgba(139,92,246,0.08)',
      accentBorder: 'rgba(139,92,246,0.18)',
    },
  ];

  const recentOrders = orders.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} {...m} index={i} />
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(29,78,216,0.1)', color: '#1d4ed8' }}
            >
              <TrendingUp size={14} />
            </div>
            <h3 className="section-card-title">Recent Bookings</h3>
          </div>
          <span className="label-low">Last {recentOrders.length} entries</span>
        </div>
        <div className="section-card-body p-0">
          <div className="divide-y" style={{ borderColor: 'var(--mono-border)' }}>
            {recentOrders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">
                  <FileText size={20} />
                </div>
                <p className="empty-state__title">No bookings yet</p>
                <p className="empty-state__desc">
                  Bookings will appear here once passengers are registered.
                </p>
              </div>
            ) : (
              recentOrders.map((order, idx) => {
                const lead = order.passengers?.[0];
                const name = lead
                  ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim()
                  : `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim() || 'Unknown';

                const statusColors: Record<string, { bg: string; text: string }> = {
                  confirmed: { bg: 'rgba(20,184,166,0.1)', text: '#0f766e' },
                  completed: { bg: 'rgba(29,78,216,0.08)', text: '#1d4ed8' },
                  pending: { bg: 'rgba(245,158,11,0.1)', text: '#b45309' },
                  rejected: { bg: 'rgba(239,68,68,0.08)', text: '#dc2626' },
                };
                const statusStyle = statusColors[order.status ?? 'pending'] ?? statusColors['pending'];

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center justify-between px-5 py-3 transition-colors"
                    style={{ cursor: 'default' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--mono-surface-muted)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)',
                          color: '#fff',
                        }}
                      >
                        {(name.charAt(0) || 'U').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--mono-text)' }}>
                          {name || 'Unknown Passenger'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--mono-text-soft)' }}>
                          {order.tour_title ?? order.tour ?? 'No tour'} · #{String(order.id).slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: statusStyle.bg, color: statusStyle.text }}
                      >
                        {order.status ?? 'pending'}
                      </span>
                      <p className="text-sm font-bold" style={{ color: '#0f766e', fontFamily: 'var(--font-display)' }}>
                        ${(order.total_price || 0).toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Confirmed', count: confirmedOrders, color: '#0f766e', bg: 'rgba(20,184,166,0.08)', icon: <CheckCircle size={16} /> },
          { label: 'Pending', count: pendingOrders, color: '#b45309', bg: 'rgba(245,158,11,0.08)', icon: <Clock size={16} /> },
          { label: 'This Month', count: orders.filter(o => {
            const created = new Date(o.created_at || '');
            const now = new Date();
            return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
          }).length, color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)', icon: <Calendar size={16} /> },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.06 }}
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: item.bg, border: '1px solid rgba(0,0,0,0.06)' }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: item.bg, color: item.color, border: `1px solid ${item.color}30` }}
            >
              {item.icon}
            </div>
            <div>
              <p
                className="text-2xl font-bold"
                style={{ color: item.color, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}
              >
                {item.count}
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--mono-text-muted)' }}>
                {item.label} orders
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
