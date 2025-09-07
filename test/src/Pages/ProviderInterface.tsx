import { useState, useEffect } from 'react';
import { FileText, MapPin, Users, Calendar, CheckCircle, Search, Eye } from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { supabase } from '../supabaseClient';
import type { Order, Tour, User as UserType, Passenger, OrderStatus } from '../types/type';

interface ProviderInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
}

function ProviderInterface({ tours, setTours, currentUser }: ProviderInterfaceProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasShowInProviderTours, setHasShowInProviderTours] = useState<boolean | null>(null);
  const [hasShowInProviderOrders, setHasShowInProviderOrders] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if show_in_provider column exists in tours table
    const checkToursSchema = async () => {
      let hasColumn = false;
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_table_columns', { table_name: 'tours' });
      if (!rpcError && rpcData) {
        hasColumn = Array.isArray(rpcData) && rpcData.some((col: any) => col.column_name === 'show_in_provider');
      } else {
        console.warn("get_table_columns RPC failed for tours, falling back to information_schema:", rpcError?.message);
        const { data: schemaData, error: schemaError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'tours')
          .eq('column_name', 'show_in_provider');
        if (schemaError) {
          console.error("Error checking tours schema:", schemaError);
          toast.error(`Failed to verify tours schema: ${schemaError.message}`);
          return;
        }
        hasColumn = schemaData.length > 0;
      }
      setHasShowInProviderTours(hasColumn);
      console.log("show_in_provider column exists in tours:", hasColumn);
    };

    // Check if show_in_provider column exists in orders table
    const checkOrdersSchema = async () => {
      let hasColumn = false;
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_table_columns', { table_name: 'orders' });
      if (!rpcError && rpcData) {
        hasColumn = Array.isArray(rpcData) && rpcData.some((col: any) => col.column_name === 'show_in_provider');
      } else {
        console.warn("get_table_columns RPC failed for orders, falling back to information_schema:", rpcError?.message);
        const { data: schemaData, error: schemaError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'orders')
          .eq('column_name', 'show_in_provider');
        if (schemaError) {
          console.error("Error checking orders schema:", schemaError);
          toast.error(`Failed to verify orders schema: ${schemaError.message}`);
          return;
        }
        hasColumn = schemaData.length > 0;
      }
      setHasShowInProviderOrders(hasColumn);
      console.log("show_in_provider column exists in orders:", hasColumn);
    };

    const uuidToNumber = (uuid: string) => {
      let hash = 0;
      for (let i = 0; i < uuid.length; i++) {
        hash = (hash << 5) - hash + uuid.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    checkToursSchema();
    checkOrdersSchema();

    // Fetch orders
    const fetchOrders = async () => {
      setLoading(true);
      let query = supabase
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
          ),
          users!created_by(email)
        `)
        .in('status', ['confirmed', 'pending']);

      if (hasShowInProviderOrders) {
        query = query.eq('show_in_provider', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
        toast.error(`Failed to fetch orders: ${error.message}`);
        setLoading(false);
        return;
      }

      const ordersWithTotals: Order[] = data.map((order) => ({
        id: String(order.id),
        user_id: String(order.user_id),
        tour_id: String(order.tour_id),
        phone: order.phone ?? null,
        last_name: order.last_name ?? null,
        first_name: order.first_name ?? null,
        email: order.email ?? null,
        age: order.age ?? null,
        gender: order.gender ?? null,
        tour: order.tour ?? null,
        passport_number: order.passport_number ?? null,
        passport_expire: order.passport_expiry ?? null,
        passport_copy: order.passport_copy ?? null,
        commission: order.commission ?? null,
        created_by: order.created_by ? String(order.created_by) : null,
        edited_by: order.edited_by ? String(order.edited_by) : null,
        edited_at: order.edited_at ?? null,
        travel_choice: order.travel_choice,
        status: order.status as OrderStatus,
        hotel: order.hotel ?? null,
        room_number: order.room_number ?? null,
        payment_method: order.payment_method ?? null,
        created_at: order.created_at,
        updated_at: order.updated_at,
        passengers: order.passengers ?? [],
        departureDate: order.departureDate ?? '',
        createdBy: order.users?.email ?? order.createdBy ?? null,
        total_price: order.total_price,
        total_amount: order.total_amount,
        paid_amount: order.paid_amount,
        balance: order.balance,
        show_in_provider: order.show_in_provider ?? false,
      }));

      setOrders(ordersWithTotals);
      console.log('Fetched orders:', ordersWithTotals);
      setLoading(false);
    };

    // Fetch creator emails for tours if creator_name is missing
    const fetchCreatorEmails = async () => {
      const toursWithEmails = await Promise.all(
        tours.map(async (tour) => {
          if (tour.created_by && !tour.creator_name) {
            const { data, error } = await supabase
              .from('users')
              .select('email')
              .eq('id', tour.created_by)
              .single();
            return {
              ...tour,
              creator_name: error ? 'Unknown Creator' : data.email || 'Unknown Creator'
            };
          }
          return tour;
        })
      );
      setTours(toursWithEmails);
    };

    // Only fetch orders and emails after schema checks are complete
    if (hasShowInProviderOrders !== null && hasShowInProviderTours !== null) {
      fetchOrders();
      if (tours.some(tour => !tour.creator_name)) {
        fetchCreatorEmails();
      }
    }

    // Orders subscription
    const orderSubscription = supabase
      .channel(`provider_orders_${Math.random().toString(36).substring(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: hasShowInProviderOrders
            ? 'status=in.(confirmed,pending),show_in_provider=eq.true'
            : 'status=in.(confirmed,pending)',
        },
        (payload) => {
          console.log("Received orders subscription payload:", JSON.stringify(payload, null, 2));
          if (payload.eventType === 'UPDATE') {
            setOrders((prev) =>
              prev.map((order) =>
                order.id === String(payload.new.id)
                  ? {
                      ...order,
                      ...payload.new,
                      id: String(payload.new.id),
                      user_id: String(payload.new.user_id),
                      tour_id: String(payload.new.tour_id),
                      created_by: payload.new.created_by ? String(payload.new.created_by) : null,
                      edited_by: payload.new.edited_by ? String(payload.new.edited_by) : null,
                      passengers: payload.new.passengers ?? order.passengers,
                      total_amount: payload.new.total_amount,
                      total_price: order.total_price,
                      paid_amount: payload.new.paid_amount,
                      balance: payload.new.balance,
                      show_in_provider: payload.new.show_in_provider ?? false,
                      createdBy: payload.new.users?.email ?? payload.new.createdBy ?? null,
                    } as Order
                  : order
              )
            );
            console.log("Order updated:", payload.new);
          } else if (payload.eventType === 'INSERT') {
            if (
              ['confirmed', 'pending'].includes(payload.new.status) &&
              (!hasShowInProviderOrders || payload.new.show_in_provider === true)
            ) {
              setOrders((prev) => [
                ...prev,
                {
                  id: String(payload.new.id),
                  user_id: String(payload.new.user_id),
                  tour_id: String(payload.new.tour_id),
                  phone: payload.new.phone ?? null,
                  last_name: payload.new.last_name ?? null,
                  first_name: payload.new.first_name ?? null,
                  email: payload.new.email ?? null,
                  age: payload.new.age ?? null,
                  gender: payload.new.gender ?? null,
                  tour: payload.new.tour ?? null,
                  passport_number: payload.new.passport_number ?? null,
                  passport_expire: payload.new.passport_expiry ?? null,
                  passport_copy: payload.new.passport_copy ?? null,
                  commission: payload.new.commission ?? null,
                  created_by: payload.new.created_by ? String(payload.new.created_by) : null,
                  edited_by: payload.new.edited_by ? String(payload.new.edited_by) : null,
                  edited_at: payload.new.edited_at ?? null,
                  travel_choice: payload.new.travel_choice,
                  status: payload.new.status as OrderStatus,
                  hotel: payload.new.hotel ?? null,
                  room_number: payload.new.room_number ?? null,
                  payment_method: payload.new.payment_method ?? null,
                  created_at: payload.new.created_at,
                  updated_at: payload.new.updated_at,
                  passengers: payload.new.passengers ?? [],
                  departureDate: payload.new.departureDate ?? '',
                  createdBy: payload.new.users?.email ?? payload.new.createdBy ?? null,
                  total_price: payload.new.total_price,
                  total_amount: payload.new.total_amount,
                  paid_amount: payload.new.paid_amount,
                  balance: payload.new.balance,
                  show_in_provider: payload.new.show_in_provider ?? false,
                } as Order,
              ]);
              console.log("Order inserted:", payload.new);
            }
          } else if (payload.eventType === 'DELETE') {
            setOrders((prev) => prev.filter((order) => order.id !== String(payload.old.id)));
            console.log("Order deleted:", payload.old.id);
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error('Order subscription error:', error);
          toast.error(`Real-time subscription failed: ${error.message}`);
        } else {
          console.log("Order subscription status:", status);
        }
      });

    // Tours subscription
    const tourSubscription = supabase
      .channel(`provider_tours_${Math.random().toString(36).substring(2)}`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'tours',
          select: `
            id,
            title,
            name,
            departureDate,
            created_by,
            creator_name:users!created_by(email),
            description,
            hotels,
            dates,
            seats,
            status,
            show_in_provider,
            services,
            base_price,
            created_at,
            updated_at,
            available_seats,
            price_base,
            tour_number
          `,
        },
        (payload) => {
          console.log("Received tours subscription payload:", JSON.stringify(payload, null, 2));
          const mapToTour = (data: any): Tour => {
            console.log("Raw creator_name:", data.creator_name);
            const tour = {
              id: String(data.id),
              title: data.title || "Untitled Tour",
              name: data.name || "Unknown Tour",
              departureDate: data.departureDate || "1970-01-01",
              created_by: data.created_by || "system",
              description: data.description || "",
              hotels: data.hotels || [],
              dates: data.dates || [],
              seats: Number(data.seats) || 0,
              status: data.status || "active",
              show_in_provider: hasShowInProviderTours ? (data.show_in_provider ?? true) : null,
              services: data.services || [],
              base_price: data.base_price || 0,
              created_at: data.created_at || undefined,
              updated_at: data.updated_at || undefined,
              available_seats: data.available_seats || 0,
              price_base: data.price_base || undefined,
              creator_name: typeof data.creator_name === 'object' ? data.creator_name?.email || "Unknown Creator" : data.creator_name || "Unknown Creator",
              tour_number: data.tour_number || "0"
            };
            console.log("Mapped tour:", tour);
            return tour;
          };

          if (payload.eventType === 'UPDATE') {
            console.log("Raw show_in_provider:", payload.new.show_in_provider);
            if (hasShowInProviderTours && payload.new.show_in_provider === undefined) {
              // Fetch full tour if show_in_provider is missing
              const fetchFullTour = async () => {
                const { data, error } = await supabase
                  .from("tours")
                  .select(`
                    id,
                    title,
                    name,
                    departureDate,
                    created_by,
                    creator_name:users!created_by(email),
                    description,
                    hotels,
                    dates,
                    seats,
                    status,
                    show_in_provider,
                    services,
                    base_price,
                    created_at,
                    updated_at,
                    available_seats,
                    price_base,
                    tour_number
                  `)
                  .eq("id", payload.new.id)
                  .single();
                if (error) {
                  console.error("Error fetching full tour:", error);
                  toast.error(`Failed to fetch tour data: ${error.message}`);
                  return;
                }
                console.log("Fetched full tour show_in_provider:", data.show_in_provider);
                setTours((prev) => {
                  if (hasShowInProviderTours && data.show_in_provider === false) {
                    console.log(`Removing tour ${payload.new.id} from ProviderInterface (show_in_provider = false)`);
                    return prev.filter((tour) => tour.id !== payload.new.id);
                  }
                  return prev.map((tour) =>
                    tour.id === payload.new.id
                      ? { ...mapToTour(data), show_in_provider: data.show_in_provider ?? true }
                      : tour
                  );
                });
              };
              fetchFullTour();
            } else if (payload.new?.id && payload.new?.title && payload.new?.name && payload.new?.departureDate && payload.new?.created_by) {
              setTours((prev) => {
                if (hasShowInProviderTours && payload.new.show_in_provider === false) {
                  console.log(`Removing tour ${payload.new.id} from ProviderInterface (show_in_provider = false)`);
                  return prev.filter((tour) => tour.id !== payload.new.id);
                }
                return prev.map((tour) =>
                  tour.id === payload.new.id ? mapToTour(payload.new) : tour
                );
              });
              console.log("Tour updated:", payload.new);
            } else {
              console.error("Invalid UPDATE payload:", payload.new);
            }
          } else if (payload.eventType === 'INSERT') {
            if (
              (!hasShowInProviderTours || payload.new?.show_in_provider) &&
              payload.new?.id &&
              payload.new?.title &&
              payload.new?.name &&
              payload.new?.departureDate &&
              payload.new?.created_by
            ) {
              setTours((prev) => [...prev, mapToTour(payload.new)]);
              console.log("Tour inserted:", payload.new);
            } else {
              console.error("Invalid INSERT payload:", payload.new);
            }
          } else if (payload.eventType === 'DELETE') {
            setTours((prev) => prev.filter((tour) => tour.id !== String(payload.old.id)));
            console.log("Tour deleted:", payload.old.id);
          }
        }
      )
      .subscribe((status, error) => {
        if (error) {
          console.error('Tour subscription error:', error);
          toast.error(`Real-time tour subscription failed: ${error.message}`);
        } else {
          console.log("Tour subscription status:", status);
        }
      });

    return () => {
      supabase.removeChannel(orderSubscription);
      supabase.removeChannel(tourSubscription);
    };
  }, [tours, setTours, hasShowInProviderTours, hasShowInProviderOrders]);

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

  const confirmedOrders = orders.filter((order) => ['confirmed', 'pending'].includes(order.status) && (!hasShowInProviderOrders || order.show_in_provider));

  const uniqueDates = Array.from(
    new Set(confirmedOrders.map((order) => (order.departureDate ? new Date(order.departureDate).toLocaleDateString('en-US') : 'Not set')))
  ).sort();

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

  const filteredTours = tours.filter((tour) => !hasShowInProviderTours || tour.show_in_provider);

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

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Provider Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your tour orders</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p>
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
                <p className="text-sm font-medium text-gray-600">Available Tours</p>
                <p className="text-2xl font-bold text-gray-900">{filteredTours.length}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              {selectedOrder ? 'Order Details' : 'All Orders'}
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

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading orders...</p>
            </div>
          ) : selectedOrder ? (
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
                      ? 'No orders match your search or date filter.'
                      : 'No orders available yet.'}
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
                        Edited At
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Method
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
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}
                          >
                            {order.status === 'confirmed' ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <FileText className="w-3 h-3 mr-1" />
                            )}
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${order.total_amount?.toFixed(2) || '0.00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.createdBy || order.created_by || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.edited_at ? formatDate(order.edited_at) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {order.payment_method || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <MapPin className="w-5 h-5 mr-2" />
            Available Tours
          </h3>

          {filteredTours.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-lg font-medium mb-2">No tours available</p>
              <p className="text-gray-400 text-sm">
                {hasShowInProviderTours ? 'No tours available for providers.' : 'Tours display unavailable.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTours.map((tour) => (
                <div key={tour.id} className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                        #{tour.id.slice(0, 3)}
                      </span>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${tour.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : tour.status === 'full'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                          }`}
                      >
                        {tour.status || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="mb-4">
                      <h4 className="text-lg font-bold text-gray-900 mb-2 flex items-center group-hover:text-blue-600 transition-colors">
                        <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                        {tour.title || 'Unnamed Tour'}
                      </h4>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                          <span className="text-sm text-gray-600">Departure</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatDate(tour.departureDate)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-green-500" />
                            <span className="text-xs text-gray-600">Total</span>
                          </div>
                          <span className="text-sm font-bold text-green-700">
                            {tour.seats || 0}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-blue-500" />
                            <span className="text-xs text-gray-600">Available</span>
                          </div>
                          <span className="text-sm font-bold text-blue-700">
                            {tour.available_seats || 0}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <div className="text-left">
                          <p className="text-xs text-gray-500 mb-1">Created by</p>
                          <p className="text-sm font-medium text-gray-900">
                            {tour.creator_name || tour.created_by || 'N/A'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">Base Price</p>
                          <p className="text-lg font-bold text-indigo-600">
                            ${tour.base_price?.toFixed(2) || '0.00'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 pb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${tour.seats > 0 ? ((tour.seats - (tour.available_seats || 0)) / tour.seats) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Booked: {(tour.seats || 0) - (tour.available_seats || 0)}</span>
                      <span>{tour.seats > 0 ? Math.round(((tour.seats - (tour.available_seats || 0)) / tour.seats) * 100) : 0}% Full</span>
                    </div>
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