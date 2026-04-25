import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Plane,
  CreditCard,
  Calendar,
  TrendingUp,
  Clock,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Plus,
  Eye,
  Settings,
  BarChart3,
} from 'lucide-react';
import type { User as UserType, Order } from '../../types/type';
import { supabase } from '../../supabaseClient';
import AppShell from '../design/AppShell';
import KpiCard from '../design/KpiCard';
import StatusBadge from '../design/StatusBadge';
import StepIndicator from '../design/StepIndicator';
import type { Step } from '../design/StepIndicator';
import NextActionPanel from '../design/NextActionPanel';

interface AdminDashboardProps {
  currentUser: UserType;
  onLogout: () => void;
}

interface Stats {
  totalUsers: number;
  pendingRequests: number;
  activeTours: number;
  totalRevenue: number;
  usersTrend: number;
  requestsTrend: number;
  toursTrend: number;
  revenueTrend: number;
}

interface RecentActivity {
  id: string;
  type: 'user' | 'booking' | 'payment' | 'tour';
  title: string;
  description: string;
  status: string;
  time: string;
}

export default function AdminDashboard({ currentUser, onLogout }: AdminDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingRequests: 0,
    activeTours: 0,
    totalRevenue: 0,
    usersTrend: 0,
    requestsTrend: 0,
    toursTrend: 0,
    revenueTrend: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  // Workflow steps for seat request
  const workflowSteps: Step[] = [
    { id: '1', title: 'Request', description: 'Submit seat request', status: 'completed' },
    { id: '2', title: 'Approval', description: 'Admin approves', status: 'active' },
    { id: '3', title: 'Tour Selection', description: 'Choose tour & date', status: 'pending' },
    { id: '4', title: 'Booking', description: 'Confirm booking', status: 'locked' },
    { id: '5', title: 'Payment', description: 'Process payment', status: 'locked' },
  ];

  useEffect(() => {
    loadStats();
    loadRecentActivity();
    loadOrders();
  }, []);

  const loadStats = async () => {
    try {
      const [usersResult, pendingResult, toursResult, ordersResult] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('pending_users').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('tours').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('orders').select('total_price, status'),
      ]);

      const totalRevenue = (ordersResult.data || [])
        .filter((o: any) => ['confirmed', 'completed'].includes(o.status?.toLowerCase()))
        .reduce((sum: number, o: any) => sum + (o.total_price || 0), 0);

      setStats({
        totalUsers: usersResult.count || 0,
        pendingRequests: pendingResult.count || 0,
        activeTours: toursResult.count || 0,
        totalRevenue: totalRevenue,
        usersTrend: 12,
        requestsTrend: -5,
        toursTrend: 8,
        revenueTrend: 15,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    const mockActivity: RecentActivity[] = [
      {
        id: '1',
        type: 'user',
        title: 'New user registered',
        description: 'Sarah Johnson registered as Agent',
        status: 'pending',
        time: '5 minutes ago',
      },
      {
        id: '2',
        type: 'booking',
        title: 'Booking confirmed',
        description: 'Tour: Dubai New Year 2026 - 12 passengers',
        status: 'confirmed',
        time: '15 minutes ago',
      },
      {
        id: '3',
        type: 'payment',
        title: 'Payment received',
        description: 'Order #ORD-2024-156 - ₮5,400,000',
        status: 'completed',
        time: '1 hour ago',
      },
      {
        id: '4',
        type: 'tour',
        title: 'Tour created',
        description: 'Japan Cherry Blossom 2026',
        status: 'active',
        time: '2 hours ago',
      },
    ];

    setRecentActivity(mockActivity);
  };

  const loadOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setOrders(data as Order[]);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('mn-MN', {
      style: 'currency',
      currency: 'MNT',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return <Users size={16} />;
      case 'booking': return <Plane size={16} />;
      case 'payment': return <CreditCard size={16} />;
      case 'tour': return <Calendar size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getActivityIconBg = (type: string) => {
    switch (type) {
      case 'user': return 'bg-primary-soft text-primary';
      case 'booking': return 'bg-accent-soft text-accent';
      case 'payment': return 'bg-warning-soft text-warning';
      case 'tour': return 'bg-info-soft text-info';
      default: return 'bg-neutral-soft text-neutral';
    }
  };

  return (
    <AppShell currentUser={currentUser} onLogout={onLogout}>
      {/* Page Header with Breadcrumb */}
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to="/admin" className="page-breadcrumb-item">Home</Link>
          <ChevronRight size={12} className="page-breadcrumb-separator" />
          <span>Dashboard</span>
        </div>
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">
          Welcome back, {currentUser.first_name || 'Admin'}. Here's what's happening today.
        </p>
        <div className="page-actions">
          <button className="btn btn--primary">
            <Plus size={16} />
            Create Tour
          </button>
          <Link to="/analytics" className="btn btn--secondary">
            <BarChart3 size={16} />
            View Analytics
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Total Users"
          value={stats.totalUsers}
          icon={<Users size={20} />}
          change={{ value: stats.usersTrend, type: 'increase', label: 'vs last month' }}
          loading={loading}
        />
        <KpiCard
          label="Pending Requests"
          value={stats.pendingRequests}
          icon={<Clock size={20} />}
          change={{ value: Math.abs(stats.requestsTrend), type: stats.requestsTrend > 0 ? 'increase' : 'decrease', label: 'vs last week' }}
          loading={loading}
        />
        <KpiCard
          label="Active Tours"
          value={stats.activeTours}
          icon={<Plane size={20} />}
          change={{ value: stats.toursTrend, type: 'increase', label: 'vs last month' }}
          loading={loading}
        />
        <KpiCard
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<CreditCard size={20} />}
          change={{ value: stats.revenueTrend, type: 'increase', label: 'vs last month' }}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Recent Activity</h2>
              <Link to="/activity" className="btn btn--ghost btn--sm">
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="card-body--compact">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 py-3 border-b border-border-light last:border-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityIconBg(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-text">{activity.title}</div>
                    <div className="text-xs text-muted">{activity.description}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={activity.status} size="sm" />
                    <span className="text-xs text-muted">{activity.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Quick Actions</h2>
            </div>
            <div className="card-body--compact space-y-2">
              <Link to="/pending-users" className="btn btn--secondary w-full justify-start relative">
                <Users size={16} />
                Approve Requests
                {stats.pendingRequests > 0 && (
                  <span className="badge badge--warning absolute -top-1 -right-1">{stats.pendingRequests}</span>
                )}
              </Link>
              <Link to="/tours/new" className="btn btn--secondary w-full justify-start">
                <Plane size={16} />
                Create Tour
              </Link>
              <Link to="/bookings" className="btn btn--secondary w-full justify-start">
                <Calendar size={16} />
                View Bookings
              </Link>
              <Link to="/admin-settings" className="btn btn--secondary w-full justify-start">
                <Settings size={16} />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Preview */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <BarChart3 size={18} />
            Seat Request Workflow
          </h2>
          <span className="text-sm text-muted">Step-by-step guide</span>
        </div>
        <StepIndicator steps={workflowSteps} currentStep="2" />
        
        <NextActionPanel
          title="Next Action Required"
          description="Review and approve the pending seat request from Sarah Johnson."
          actions={
            <>
              <button className="btn btn--primary">Approve Request</button>
              <Link to="/requests/pending" className="btn btn--ghost">View Details</Link>
            </>
          }
        />
      </div>

      {/* Recent Orders Table */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <Plane size={18} />
            Recent Bookings
          </h2>
          <Link to="/bookings" className="btn btn--ghost btn--sm">
            View all
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Tour</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    No recent bookings
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-sm">#{order.order_id?.slice(-6) || order.id?.slice(-6)}</td>
                    <td className="font-medium">{order.tour_title || 'N/A'}</td>
                    <td>{order.first_name} {order.last_name}</td>
                    <td>{order.departureDate ? new Date(order.departureDate).toLocaleDateString() : '-'}</td>
                    <td className="font-medium">{formatCurrency(order.total_price || 0)}</td>
                    <td>
                      <StatusBadge status={order.status || 'pending'} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}