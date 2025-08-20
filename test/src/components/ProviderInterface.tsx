import { useState, useEffect } from 'react';
import { FileText, Eye, MapPin, Users, Calendar, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { supabase } from '../supabaseClient';
import type { Order, Tour, User as UserType, Passenger, OrderStatus } from '../types/type';

interface ProviderInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
  onLogout: () => void;
}

function ProviderInterface({ tours, setTours, currentUser, onLogout }: ProviderInterfaceProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Fetch confirmed orders
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          passengers (
            id,
            first_name,
            last_name,
            date_of_birth,
            age,
            gender,
            passport_number,
            passport_expiry,
            nationality,
            roomType,
            room_allocation,
            hotel,
            additional_services,
            allergy,
            email,
            phone,
            emergency_phone,
            price
          )
        `)
        .eq('status', 'confirmed');
      if (error) {
        console.error('Error fetching orders:', error);
        toast.error(`Failed to fetch orders: ${error.message}`);
      } else {
        const ordersWithTotals = data.map((order: any) => ({
          id: String(order.id),
          user_id: order.user_id,
          tour_id: order.tour_id,
          phone: order.phone ?? null,
          last_name: order.last_name ?? null,
          first_name: order.first_name ?? null,
          age: order.age ?? null,
          gender: order.gender ?? null,
          tour: order.tour ?? null,
          passport_number: order.passport_number ?? null,
          passport_expire: order.passport_expire ?? null,
          passport_copy: order.passport_copy ?? null,
          commission: order.commission ?? null,
          created_by: order.created_by ?? null,
          edited_by: order.edited_by ?? null,
          edited_at: order.edited_at ?? null,
          travel_choice: order.travel_choice,
          status: order.status as OrderStatus,
          hotel: order.hotel ?? null,
          room_number: order.room_number ?? null,
          payment_method: order.payment_method ?? null,
          created_at: order.created_at,
          updated_at: order.updated_at,
          passengers: order.passengers ?? [],
          departureDate: order.departureDate ?? null,
          createdBy: order.createdBy ?? null,
          total_amount: order.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || 0,
          total_price: order.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || 0,
          paid_amount: 0, // Placeholder
          balance: order.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || 0,
        } as Order));
        setOrders(ordersWithTotals);
        console.log('Fetched orders:', ordersWithTotals);
      }
    };

    fetchOrders();

    // Real-time subscription
    const subscription = supabase
      .channel('confirmed_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: 'status=eq.confirmed' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((order) =>
                order.id === String(payload.new.id)
                  ? {
                      ...order,
                      ...payload.new,
                      id: String(payload.new.id),
                      passengers: payload.new.passengers ?? order.passengers,
                      total_amount: payload.new.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || order.total_amount || 0,
                      total_price: payload.new.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || order.total_price || 0,
                      paid_amount: 0,
                      balance: payload.new.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || order.balance || 0,
                    } as Order
                  : order
              )
            );
          } else if (payload.eventType === 'INSERT') {
            if (payload.new.status === 'confirmed') {
              setOrders((prev) => [
                ...prev,
                {
                  id: String(payload.new.id),
                  user_id: payload.new.user_id,
                  tour_id: payload.new.tour_id,
                  phone: payload.new.phone ?? null,
                  last_name: payload.new.last_name ?? null,
                  first_name: payload.new.first_name ?? null,
                  age: payload.new.age ?? null,
                  gender: payload.new.gender ?? null,
                  tour: payload.new.tour ?? null,
                  passport_number: payload.new.passport_number ?? null,
                  passport_expire: payload.new.passport_expire ?? null,
                  passport_copy: payload.new.passport_copy ?? null,
                  commission: payload.new.commission ?? null,
                  created_by: payload.new.created_by ?? null,
                  edited_by: payload.new.edited_by ?? null,
                  edited_at: payload.new.edited_at ?? null,
                  travel_choice: payload.new.travel_choice,
                  status: payload.new.status as OrderStatus,
                  hotel: payload.new.hotel ?? null,
                  room_number: payload.new.room_number ?? null,
                  payment_method: payload.new.payment_method ?? null,
                  created_at: payload.new.created_at,
                  updated_at: payload.new.updated_at,
                  passengers: payload.new.passengers ?? [],
                  departureDate: payload.new.departureDate ?? null,
                  createdBy: payload.new.createdBy ?? null,
                  total_amount: payload.new.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || 0,
                  total_price: payload.new.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || 0,
                  paid_amount: 0,
                  balance: payload.new.passengers?.reduce((sum: number, p: Passenger) => sum + (p.price || 0), 0) || 0,
                } as Order,
              ]);
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((order) => order.id !== String(payload.old.id)));
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error('Subscription error:', error);
          toast.error(`Real-time subscription failed: ${error.message}`);
        }
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const previousOrders = [...orders];
    const updatedOrders = orders.map((o) =>
      o.id === orderId
        ? { ...o, status, edited_by: currentUser.id, edited_at: new Date().toISOString() }
        : o
    );
    setOrders(updatedOrders);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, edited_by: currentUser.id, edited_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) {
        console.error('Error updating status:', error);
        toast.error(`Error updating status: ${error.message}`);
        setOrders(previousOrders);
      } else {
        toast.success('Order status updated!');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Unexpected error updating status.');
      setOrders(previousOrders);
    }
  };

  // Filter orders to only include those with status 'confirmed'
  const confirmedOrders = orders.filter((order) => order.status === 'confirmed');

  // Get unique departure dates from confirmed orders
  const uniqueDates = Array.from(
    new Set(confirmedOrders.map((order) => order.departureDate ? new Date(order.departureDate).toLocaleDateString('en-US') : 'Not set'))
  ).sort();

  // Filter confirmed orders based on date and search term
  const filteredOrders = confirmedOrders.filter((order) => {
    const lowerTerm = searchTerm.toLowerCase();
    return (
      (selectedDate
        ? (order.departureDate ? new Date(order.departureDate).toLocaleDateString('en-US') : 'Not set') === selectedDate
        : true) &&
      ((order.phone?.toLowerCase().includes(lowerTerm) || false) ||
        (order.first_name?.toLowerCase().includes(lowerTerm) || false) ||
        (order.last_name?.toLowerCase().includes(lowerTerm) || false) ||
        (order.departureDate ? new Date(order.departureDate).toLocaleDateString('en-US') : 'Not set').includes(lowerTerm))
    );
  });

  // Status options
  const statusOptions: OrderStatus[] = [
    'pending',
    'confirmed',
    'Cancelled',
    'Information given',
    'Need to give information',
    'Need to tell got a seat/in waiting',
    'Need to conclude a contract',
    'Concluded a contract',
    'Postponed the travel',
    'Interested in other travel',
    'Cancelled after confirmed',
    'Cancelled after ordered a seat',
    'Cancelled after take a information',
    'Paid the advance payment',
    'Need to meet',
    'Sent a claim',
    'Fam Tour',
    'The travel is going',
    'Travel ended completely',
    'Has taken seat from another company',
    'Swapped seat with another company',
    'Gave seat to another company',
    'Cancelled and bought travel from another country',
  ];

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Provider Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your tour orders</p>
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Confirmed Orders</p>
                <p className="text-2xl font-bold text-gray-900">{confirmedOrders.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Passengers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {confirmedOrders.reduce((sum, order) => sum + (order.passengers?.length || 0), 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tours</p>
                <p className="text-2xl font-bold text-gray-900">{tours.length}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Orders Management */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              {selectedOrder ? 'Order Details' : 'All Confirmed Orders'}
            </h3>
            {!selectedOrder && (
              <div className="flex gap-4">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  <option value="">All Dates</option>
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by phone, name, or date"
                    className="w-64 px-3 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                </div>
              </div>
            )}
          </div>

          {selectedOrder ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                    <MapPin className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Tour</h4>
                      <p className="text-sm text-gray-600">{selectedOrder.travel_choice || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-green-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Departure Date</h4>
                      <p className="text-sm text-gray-600">{formatDate(selectedOrder.departureDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-purple-50 rounded-lg">
                    <Users className="w-8 h-8 text-purple-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Total Passengers</h4>
                      <p className="text-sm text-gray-600">{selectedOrder.passengers?.length || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Update Status</h4>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value as OrderStatus)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Commission</h4>
                    <p className="text-sm text-gray-600">${selectedOrder.commission?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Payment Method</h4>
                    <p className="text-sm text-gray-600">{selectedOrder.payment_method || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <h4 className="font-medium text-gray-900 mb-4">Passenger Details</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nationality
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hotel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Allergy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Emergency Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedOrder.passengers?.map((passenger: Passenger) => (
                      <tr key={passenger.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.first_name || 'N/A'} {passenger.last_name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.nationality || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.roomType || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.hotel || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${passenger.price?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.allergy || 'None'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.emergency_phone || 'N/A'}
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          No passengers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Back to Orders
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm || selectedDate
                      ? 'No confirmed orders match your search or date filter.'
                      : 'No confirmed orders available yet.'}
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tour
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departure
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Passengers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Edited By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Edited At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#{order.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {order.travel_choice || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {formatDate(order.departureDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3 mr-1" />
                            {order.passengers?.length || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.status === 'confirmed' ||
                              order.status === 'Concluded a contract' ||
                              order.status === 'Travel ended completely'
                                ? 'bg-green-100 text-green-800'
                                : order.status.includes('Cancelled') || order.status === 'Cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {order.status === 'confirmed' ||
                            order.status === 'Concluded a contract' ||
                            order.status === 'Travel ended completely' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : order.status.includes('Cancelled') || order.status === 'Cancelled' ? (
                              <XCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <FileText className="w-3 h-3 mr-1" />
                            )}
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${order.total_amount?.toFixed(2) || order.commission?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.createdBy || order.created_by || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.edited_by || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.edited_at ? formatDate(order.edited_at) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.payment_method || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Tours Overview */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Available Tours
          </h3>
          {tours.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No tours available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tours.map((tour) => (
                <div key={tour.id} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{tour.title || 'N/A'}</h4>
                  <p className="text-sm text-gray-600 mt-1">{tour.description || 'No description'}</p>
                  <div className="mt-2 text-sm text-gray-600">
                    <p>
                      <strong>Seats:</strong> {tour.seats || 'N/A'}
                    </p>
                    <p>
                      <strong>Dates:</strong>{' '}
                      {tour.dates?.map((d) => formatDate(d)).join(', ') || 'Not set'}
                    </p>
                    <p>
                      <strong>Hotels:</strong> {tour.hotels?.join(', ') || 'N/A'}
                    </p>
                    <p>
                      <strong>Services:</strong>{' '}
                      {tour.services?.map((s) => `${s.name} ($${s.price?.toFixed(2) || '0.00'})`).join(', ') || 'None'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProviderInterface;