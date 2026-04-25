import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Plane,
  CreditCard,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Eye,
  UserCheck,
  DollarSign,
  Settings,
  BarChart3,
  Plus,
  ChevronRight,
} from 'lucide-react';
import type { User as UserType, Order } from '../../types/type';
import { supabase } from '../../supabaseClient';
import AppShell from '../design/AppShell';
import KpiCard from '../design/KpiCard';
import StatusBadge from '../design/StatusBadge';
import StepIndicator from '../design/StepIndicator';
import type { Step } from '../design/StepIndicator';
import NextActionPanel from '../design/NextActionPanel';

interface ManagerDashboardProps {
  currentUser: UserType;
  onLogout: () => void;
}

interface Stats {
  teamMembers: number;
  activeBookings: number;
  pendingApprovals: number;
  monthlyRevenue: number;
}

interface PendingRequest {
  id: string;
  type: 'user' | 'booking' | 'payment';
  title: string;
  submittedBy: string;
  amount?: number;
  status: string;
  submittedAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastActive: string;
}

export default function ManagerDashboard({ currentUser, onLogout }: ManagerDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    teamMembers: 0,
    activeBookings: 0,
    pendingApprovals: 0,
    monthlyRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  // Monitoring workflow steps
  const workflowSteps: Step[] = [
    { id: '1', title: 'Review', description: 'Review request', status: 'completed' },
    { id: '2', title: 'Approve', description: 'Manager approval', status: 'active' },
    { id: '3', title: 'Process', description: 'Process booking', status: 'pending' },
    { id: '4', title: 'Complete', description: 'Mark complete', status: 'locked' },
  ];

  useEffect(() => {
    loadStats();
    loadPendingRequests();
    loadTeamMembers();
    loadRecentOrders();
  }, []);

  const loadStats = async () => {
    try {
      const [usersResult, ordersResult, pendingResult] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('pending_users').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setStats({
        teamMembers: usersResult.count || 0,
        activeBookings: ordersResult.count || 0,
        pendingApprovals: pendingResult.count || 0,
        monthlyRevenue: 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingRequests = async () => {
    const mockRequests: PendingRequest[] = [
      {
        id: '1',
        type: 'user',
        title: 'New agent registration',
        submittedBy: 'John Smith',
        status: 'pending',
        submittedAt: '2 hours ago',
      },
      {
        id: '2',
        type: 'booking',
        title: 'Group booking approval',
        submittedBy: 'Sarah Johnson',
        amount: 15000000,
        status: 'pending',
        submittedAt: '4 hours ago',
      },
      {
        id: '3',
        type: 'payment',
        title: 'Payment milestone',
        submittedBy: 'Mike Davis',
        amount: 5000000,
        status: 'pending',
        submittedAt: '1 day ago',
      },
    ];

    setPendingRequests(mockRequests);
  };

  const loadTeamMembers = async () => {
    const mockTeam: TeamMember[] = [
      {
        id: '1',
        name: 'Sarah Johnson',
        email: 'sarah@company.mn',
        role: 'Agent',
        status: 'active',
        lastActive: '5 minutes ago',
      },
      {
        id: '2',
        name: 'Mike Davis',
        email: 'mike@company.mn',
        role: 'Subcontractor',
        status: 'active',
        lastActive: '1 hour ago',
      },
      {
        id: '3',
        name: 'Emma Wilson',
        email: 'emma@company.mn',
        role: 'Agent',
        status: 'inactive',
        lastActive: '2 days ago',
      },
    ];

    setTeamMembers(mockTeam);
  };

  const loadRecentOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setRecentOrders(data as Order[]);
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

  const getRequestIcon = (type: string) => {
    switch (type) {
      case 'user': return <Users size={16} />;
      case 'booking': return <FileText size={16} />;
      case 'payment': return <CreditCard size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getRequestIconBg = (type: string) => {
    switch (type) {
      case 'user': return 'bg-primary-soft text-primary';
      case 'booking': return 'bg-accent-soft text-accent';
      case 'payment': return 'bg-warning-soft text-warning';
      default: return 'bg-neutral-soft text-neutral';
    }
  };

  return (
    <AppShell currentUser={currentUser} onLogout={onLogout}>
      {/* Page Header with Breadcrumb */}
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to="/manager" className="page-breadcrumb-item">Home</Link>
          <ChevronRight size={12} className="page-breadcrumb-separator" />
          <span>Manager Dashboard</span>
        </div>
        <h1 className="page-title">Manager Dashboard</h1>
        <p className="page-subtitle">Monitor operations and approve requests</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Team Members"
          value={stats.teamMembers}
          icon={<Users size={20} />}
          change={{ value: 5, type: 'increase', label: 'new this month' }}
          loading={loading}
        />
        <KpiCard
          label="Active Bookings"
          value={stats.activeBookings}
          icon={<FileText size={20} />}
          change={{ value: 12, type: 'increase', label: 'vs last month' }}
          loading={loading}
        />
        <KpiCard
          label="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<Clock size={20} />}
          loading={loading}
        />
        <KpiCard
          label="Monthly Revenue"
          value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign size={20} />}
          change={{ value: 8, type: 'increase', label: 'vs last month' }}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pending Approvals */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Pending Approvals</h2>
              <span className="badge badge--warning">{pendingRequests.length}</span>
            </div>
            <div className="card-body--compact">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-4 py-4 border-b border-border-light last:border-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getRequestIconBg(request.type)}`}>
                    {getRequestIcon(request.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{request.title}</div>
                    <div className="text-xs text-muted">
                      by {request.submittedBy}
                      {request.amount && ` • ${formatCurrency(request.amount)}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={request.status} size="sm" />
                    <button className="btn btn--ghost btn--sm">
                      <Eye size={14} />
                    </button>
                    <button className="btn btn--accent btn--sm">
                      <CheckCircle size={14} />
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Activity */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Team Activity</h2>
              <Link to="/team" className="btn btn--ghost btn--sm">
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="card-body--compact">
              {teamMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 py-3 border-b border-border-light last:border-0">
                  <div className="w-9 h-9 rounded-full bg-neutral-soft flex items-center justify-center text-sm font-medium text-neutral">
                    {member.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{member.name}</div>
                    <div className="text-xs text-muted">{member.role}</div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={member.status} size="sm" />
                    <div className="text-xs text-muted mt-1">{member.lastActive}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Workflow Preview */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <BarChart3 size={18} />
            Approval Workflow
          </h2>
          <span className="text-sm text-muted">Manager approval steps</span>
        </div>
        <StepIndicator steps={workflowSteps} currentStep="2" />
        
        <NextActionPanel
          title="Action Required"
          description="Review the pending agent registration from John Smith."
          actions={
            <>
              <button className="btn btn--accent">Approve Registration</button>
              <Link to="/pending-users" className="btn btn--ghost">View Details</Link>
            </>
          }
        />
      </div>

      {/* Recent Orders */}
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
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted">
                    No recent bookings
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-mono text-sm">#{order.order_id?.slice(-6) || order.id?.slice(-6)}</td>
                    <td className="font-medium">{order.first_name} {order.last_name}</td>
                    <td>{order.departureDate ? new Date(order.departureDate).toLocaleDateString() : '-'}</td>
                    <td className="font-medium">{formatCurrency(order.total_price || 0)}</td>
                    <td><StatusBadge status={order.status || 'pending'} size="sm" /></td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn--ghost btn--sm">
                          <Eye size={14} />
                        </button>
                      </div>
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