import React, { useState, useEffect } from 'react';
import {
  Plane,
  Users,
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
  ArrowRight,
  Plus,
  Search,
  Calendar,
  MapPin,
  DollarSign,
} from 'lucide-react';
import type { User as UserType, Tour } from '../../types/type';
import { supabase } from '../../supabaseClient';
import AppShell from '../design/AppShell';
import KpiCard from '../design/KpiCard';
import StatusBadge from '../design/StatusBadge';
import DataTable from '../design/DataTable';
import type { Column } from '../design/DataTable';

interface AgentDashboardProps {
  currentUser: UserType;
  onLogout: () => void;
}

interface Stats {
  myBookings: number;
  pendingPayments: number;
  availableSeats: number;
  commissions: number;
}

interface Booking {
  id: string;
  orderId: string;
  customer: string;
  tour: string;
  departureDate: string;
  passengers: number;
  amount: number;
  status: string;
  createdAt: string;
}

export default function AgentDashboard({ currentUser, onLogout }: AgentDashboardProps) {
  const [stats, setStats] = useState<Stats>({
    myBookings: 0,
    pendingPayments: 0,
    availableSeats: 0,
    commissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availableTours, setAvailableTours] = useState<Tour[]>([]);

  useEffect(() => {
    loadStats();
    loadBookings();
    loadAvailableTours();
  }, []);

  const loadStats = async () => {
    try {
      const [bookingsResult, paymentsResult] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id).eq('status', 'pending'),
      ]);

      setStats({
        myBookings: bookingsResult.count || 0,
        pendingPayments: paymentsResult.count || 0,
        availableSeats: 45,
        commissions: 1250000,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    const mockBookings: Booking[] = [
      {
        id: '1',
        orderId: 'ORD-001',
        customer: 'John Smith',
        tour: 'Dubai New Year 2026',
        departureDate: '2026-01-15',
        passengers: 4,
        amount: 15000000,
        status: 'confirmed',
        createdAt: '2 days ago',
      },
      {
        id: '2',
        orderId: 'ORD-002',
        customer: 'Sarah Johnson',
        tour: 'Japan Cherry Blossom',
        departureDate: '2026-04-10',
        passengers: 2,
        amount: 8500000,
        status: 'pending',
        createdAt: '1 day ago',
      },
      {
        id: '3',
        orderId: 'ORD-003',
        customer: 'Mike Davis',
        tour: 'Turkey Summer 2026',
        departureDate: '2026-07-20',
        passengers: 6,
        amount: 22000000,
        status: 'confirmed',
        createdAt: '5 days ago',
      },
    ];

    setBookings(mockBookings);
  };

  const loadAvailableTours = async () => {
    try {
      const { data } = await supabase
        .from('tours')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5);

      if (data) {
        setAvailableTours(data as Tour[]);
      }
    } catch (error) {
      console.error('Failed to load tours:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('mn-MN', {
      style: 'currency',
      currency: 'MNT',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<Booking>[] = [
    {
      key: 'orderId',
      header: 'Order ID',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">#{item.orderId}</span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
    },
    {
      key: 'tour',
      header: 'Tour',
      sortable: true,
    },
    {
      key: 'departureDate',
      header: 'Departure',
      sortable: true,
      render: (item) => new Date(item.departureDate).toLocaleDateString(),
    },
    {
      key: 'passengers',
      header: 'Pax',
      sortable: true,
      render: (item) => `${item.passengers} pax`,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (item) => <span className="font-medium">{formatCurrency(item.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} size="sm" />,
    },
  ];

  return (
    <AppShell currentUser={currentUser} onLogout={onLogout}>
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">
            Manage your bookings and commissions
          </p>
        </div>
        <button className="btn btn--primary">
          <Plus size={16} />
          New Booking
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="My Bookings"
          value={stats.myBookings}
          icon={<FileText size={20} />}
          change={{ value: 8, type: 'increase', label: 'this month' }}
          loading={loading}
        />
        <KpiCard
          label="Pending Payments"
          value={stats.pendingPayments}
          icon={<Clock size={20} />}
          loading={loading}
        />
        <KpiCard
          label="Available Seats"
          value={stats.availableSeats}
          icon={<Users size={20} />}
          loading={loading}
        />
        <KpiCard
          label="Commissions"
          value={formatCurrency(stats.commissions)}
          icon={<DollarSign size={20} />}
          change={{ value: 15, type: 'increase', label: 'this month' }}
          loading={loading}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Tours */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Available Tours</h2>
              <button className="btn btn--ghost btn--sm">
                View all
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="divide-y divide-gray-100">
              {availableTours.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No tours available
                </div>
              ) : (
                availableTours.map((tour) => (
                  <div key={tour.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Plane size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">
                          {tour.title || 'Tour'}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {tour.departure_date && (
                            <span className="flex items-center gap-1">
                              <Calendar size={14} />
                              {new Date(tour.departure_date).toLocaleDateString()}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Users size={14} />
                            {tour.seats || 0} seats
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge status="active" size="sm" />
                          {tour.base_price && (
                            <span className="font-medium text-gray-900">
                              {formatCurrency(tour.base_price)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="btn btn--secondary btn--sm">
                        Book Now
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-4 space-y-2">
              <button className="btn btn--secondary w-full justify-start">
                <Plus size={16} />
                New Booking
              </button>
              <button className="btn btn--secondary w-full justify-start">
                <Users size={16} />
                Add Passenger
              </button>
              <button className="btn btn--secondary w-full justify-start">
                <CreditCard size={16} />
                Process Payment
              </button>
              <button className="btn btn--secondary w-full justify-start">
                <FileText size={16} />
                View My Orders
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bookings Table */}
      <div className="mt-6">
        <DataTable
          data={bookings}
          columns={columns}
          keyField="id"
          searchable={true}
          searchPlaceholder="Search bookings..."
          searchKeys={['orderId', 'customer', 'tour']}
          filterable={true}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'pending', label: 'Pending' },
                { value: 'cancelled', label: 'Cancelled' },
              ],
            },
          ]}
          paginated={true}
          pageSize={5}
          emptyMessage="No bookings found"
        />
      </div>
    </AppShell>
  );
}