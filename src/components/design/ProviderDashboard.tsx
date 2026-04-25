import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plane,
  Users,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Star,
  ArrowRight,
  Eye,
  Plus,
  ChevronRight,
  Settings,
} from 'lucide-react';
import type { User as UserType, Order, Tour } from '../../types/type';
import { supabase } from '../../supabaseClient';
import AppShell from '../design/AppShell';
import KpiCard from '../design/KpiCard';
import StatusBadge from '../design/StatusBadge';

interface ProviderDashboardProps {
  currentUser: UserType;
  onLogout: () => void;
}

interface Stats {
  activeTours: number;
  confirmedBookings: number;
  pendingTasks: number;
  passengers: number;
}

interface Task {
  id: string;
  type: 'passenger' | 'booking' | 'payment';
  title: string;
  description: string;
  dueAt: string;
  priority: 'high' | 'medium' | 'low';
}

interface Passenger {
  id: string;
  name: string;
  tour: string;
  passport: string;
  phone: string;
  status: string;
}

export default function ProviderDashboard({ currentUser, onLogout }: ProviderDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    activeTours: 0,
    confirmedBookings: 0,
    pendingTasks: 0,
    passengers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [upcomingTours, setUpcomingTours] = useState<Tour[]>([]);

  useEffect(() => {
    loadStats();
    loadTasks();
    loadPassengers();
    loadUpcomingTours();
  }, []);

  const loadStats = async () => {
    try {
      const [toursResult, ordersResult, passengersResult] = await Promise.all([
        supabase.from('tours').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
        supabase.from('passengers').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        activeTours: toursResult.count || 0,
        confirmedBookings: ordersResult.count || 0,
        pendingTasks: 3,
        passengers: passengersResult.count || 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    const mockTasks: Task[] = [
      {
        id: '1',
        type: 'passenger',
        title: 'Confirm passenger details',
        description: 'Verify passport for Booking #ORD-156',
        dueAt: 'Today',
        priority: 'high',
      },
      {
        id: '2',
        type: 'payment',
        title: 'Process payment',
        description: 'Collect final payment from client',
        dueAt: 'Tomorrow',
        priority: 'medium',
      },
      {
        id: '3',
        type: 'booking',
        title: 'Update hotel booking',
        description: 'Confirm hotel room for 4 passengers',
        dueAt: 'This week',
        priority: 'low',
      },
    ];

    setTasks(mockTasks);
  };

  const loadPassengers = async () => {
    const mockPassengers: Passenger[] = [
      {
        id: '1',
        name: 'John Smith',
        tour: 'Dubai New Year 2026',
        passport: 'AB123456',
        phone: '+976 99123456',
        status: 'confirmed',
      },
      {
        id: '2',
        name: 'Sarah Johnson',
        tour: 'Dubai New Year 2026',
        passport: 'CD789012',
        phone: '+976 99234567',
        status: 'pending',
      },
      {
        id: '3',
        name: 'Mike Davis',
        tour: 'Japan Cherry Blossom',
        passport: 'EF345678',
        phone: '+976 99345678',
        status: 'confirmed',
      },
    ];

    setPassengers(mockPassengers);
  };

  const loadUpcomingTours = async () => {
    try {
      const { data } = await supabase
        .from('tours')
        .select('*')
        .eq('status', 'active')
        .order('departure_date', { ascending: true })
        .limit(3);

      if (data) {
        setUpcomingTours(data as Tour[]);
      }
    } catch (error) {
      console.error('Failed to load tours:', error);
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'passenger': return <Users size={16} />;
      case 'booking': return <FileText size={16} />;
      case 'payment': return <Calendar size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getTaskIconBg = (type: string) => {
    switch (type) {
      case 'passenger': return 'bg-primary-soft text-primary';
      case 'booking': return 'bg-accent-soft text-accent';
      case 'payment': return 'bg-warning-soft text-warning';
      default: return 'bg-neutral-soft text-neutral';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <span className="badge badge--danger">High</span>;
      case 'medium': return <span className="badge badge--warning">Medium</span>;
      default: return <span className="badge badge--neutral">Low</span>;
    }
  };

  return (
    <AppShell currentUser={currentUser} onLogout={onLogout}>
      {/* Page Header with Breadcrumb */}
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to="/provider" className="page-breadcrumb-item">Home</Link>
          <ChevronRight size={12} className="page-breadcrumb-separator" />
          <span>Provider Dashboard</span>
        </div>
        <h1 className="page-title">Provider Dashboard</h1>
        <p className="page-subtitle">Manage tours and passenger details</p>
        <div className="page-actions">
          <button className="btn btn--primary">
            <Plus size={16} />
            Add Passenger
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Active Tours"
          value={stats.activeTours}
          icon={<Plane size={20} />}
          loading={loading}
        />
        <KpiCard
          label="Confirmed Bookings"
          value={stats.confirmedBookings}
          icon={<CheckCircle size={20} />}
          loading={loading}
        />
        <KpiCard
          label="Pending Tasks"
          value={stats.pendingTasks}
          icon={<Clock size={20} />}
          loading={loading}
        />
        <KpiCard
          label="Total Passengers"
          value={stats.passengers}
          icon={<Users size={20} />}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Upcoming Tours */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Upcoming Tours</h2>
              <Link to="/tours" className="btn btn--ghost btn--sm">
                View all
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="card-body--compact">
              {upcomingTours.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  No upcoming tours
                </div>
              ) : (
                upcomingTours.map((tour) => (
                  <div key={tour.id} className="flex items-start gap-4 py-4 border-b border-border-light last:border-0">
                    <div className="w-12 h-12 rounded-lg bg-primary-soft flex items-center justify-center flex-shrink-0">
                      <MapPin size={20} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{tour.title || 'Tour'}</div>
                      {tour.departure_date && (
                        <div className="flex items-center gap-1 text-sm text-muted mt-1">
                          <Calendar size={14} />
                          {new Date(tour.departure_date).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status="active" size="sm" />
                        <span className="text-sm text-muted">{tour.seats || 0} seats</span>
                      </div>
                    </div>
                    <button className="btn btn--secondary btn--sm">Details</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Tasks Panel */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Today's Tasks</h2>
              <span className="badge badge--warning">{tasks.length}</span>
            </div>
            <div className="card-body--compact">
              {tasks.map((task) => (
                <div key={task.id} className="py-4 border-b border-border-light last:border-0">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getTaskIconBg(task.type)}`}>
                      {getTaskIcon(task.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{task.title}</div>
                      <div className="text-xs text-muted mt-1">{task.description}</div>
                      <div className="flex items-center gap-2 mt-2">
                        {getPriorityBadge(task.priority)}
                        <span className="text-xs text-muted">Due: {task.dueAt}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button className="btn btn--accent btn--sm flex-1">
                      <CheckCircle size={14} />
                      Done
                    </button>
                    <button className="btn btn--ghost btn--sm">
                      <Eye size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Passengers Table */}
      <div className="section">
        <div className="section-header">
          <h2 className="section-title">
            <Users size={18} />
            Passenger List
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search passengers..."
              className="input input--sm w-48"
            />
            <button className="btn btn--primary btn--sm">
              <Plus size={14} />
              Add Passenger
            </button>
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tour</th>
                <th>Passport</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {passengers.map((passenger) => (
                <tr key={passenger.id}>
                  <td className="font-medium">{passenger.name}</td>
                  <td>{passenger.tour}</td>
                  <td className="font-mono text-sm">{passenger.passport}</td>
                  <td className="flex items-center gap-1 text-muted">
                    <Phone size={14} />
                    {passenger.phone}
                  </td>
                  <td>
                    <StatusBadge status={passenger.status} size="sm" />
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button className="btn btn--ghost btn--sm">
                        <Eye size={14} />
                      </button>
                      <button className="btn btn--ghost btn--sm">
                        <Mail size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}