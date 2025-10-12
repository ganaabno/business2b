import { useState, useEffect, useRef } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { supabase } from '../supabaseClient';
import type { Order, Tour, User as UserType, Passenger, OrderStatus } from '../types/type';
import DashboardHeader from '../Pages/ProviderInterfaceComponents/Dashboardheader';
import StatsCards from './ProviderInterfaceComponents/StatsCards';
import OrdersTable from '../Pages/ProviderInterfaceComponents/Orderstable';
import ToursGrid from './ProviderInterfaceComponents/ToursGrid';
import BookingConfirmationTab from '../Pages/ProviderInterfaceComponents/BookingConfirmation';
import AddTourTab from '../components/AddTourTab';
import { Users, MapPin, CheckCircle, Settings } from 'lucide-react';

// Cache to store schema check results
const schemaCache = {
  tours: null as boolean | null,
  orders: null as boolean | null,
};

interface ProviderInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
}

interface RawOrder {
  id: number | string;
  user_id: number | string;
  tour_id: number | string;
  phone?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  tour?: string | null;
  passport_number?: string | null;
  passport_expire?: string | null;
  passport_copy?: string | null;
  commission?: number | null;
  created_by?: string | number | null;
  edited_by?: string | number | null;
  edited_at?: string | null;
  travel_choice?: string;
  status: string;
  hotel?: string | null;
  room_number?: string | null;
  payment_method?: string | null;
  created_at: string;
  updated_at: string;
  departureDate?: string | null;
  total_price: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  show_in_provider?: boolean;
  createdBy?: string | null;
  passengers?: Passenger[] | null;
  users?: { email?: string | null } | null;
  booking_confirmations?: {
    id?: string;
    order_id: string;
    bus_number: string | null;
    guide_name: string | null;
    weather_emergency: string | null;
    updated_by: string | null;
    updated_at: string | null;
  } | null;
}

function ProviderInterface({ tours, setTours, currentUser }: ProviderInterfaceProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasShowInProviderTours, setHasShowInProviderTours] = useState<boolean | null>(null);
  const [hasShowInProviderOrders, setHasShowInProviderOrders] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [exportLoading, setExportLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'tours' | 'booking' | 'addTour'>('orders');
  const hasFetchedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, searchTerm]);

  // Fetch with retry logic
  const fetchWithRetry = async (fn: () => Promise<any>, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i < retries - 1) {
          console.warn(`Retry ${i + 1}/${retries} after error:`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  };

  // Refresh Supabase session to handle JWT expiration
  const refreshSession = async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error('Error refreshing session:', error);
      toast.error('Failed to refresh session.');
    }
    return data.session;
  };

  const checkOrdersSchema = async () => {
    if (schemaCache.orders !== null) {
      setHasShowInProviderOrders(schemaCache.orders);
      return;
    }
    let hasColumn = false;
    try {
      const { data: rpcData, error: rpcError } = await fetchWithRetry(async () =>
        supabase.rpc('get_table_columns', { table_name: 'orders' })
      );
      if (rpcError) throw rpcError;
      console.log('Orders schema RPC data:', rpcData);
      hasColumn = Array.isArray(rpcData) && rpcData.some((col: any) => col.column_name === 'show_in_provider');
    } catch (rpcError) {
      console.warn("get_table_columns RPC failed for orders, falling back to information_schema:", rpcError);
      try {
        const { data: schemaData, error: schemaError } = await fetchWithRetry(async () =>
          supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'orders')
            .eq('column_name', 'show_in_provider')
        );
        if (schemaError) throw schemaError;
        console.log('Orders schema information_schema data:', schemaData);
        hasColumn = schemaData.length > 0;
      } catch (schemaError) {
        console.error("Error checking orders schema:", schemaError);
        toast.error("Failed to verify orders schema.");
        return;
      }
    }
    schemaCache.orders = hasColumn;
    setHasShowInProviderOrders(hasColumn);
  };

  const checkToursSchema = async () => {
    if (schemaCache.tours !== null) {
      setHasShowInProviderTours(schemaCache.tours);
      return;
    }
    let hasColumn = false;
    try {
      const { data: rpcData, error: rpcError } = await fetchWithRetry(async () =>
        supabase.rpc('get_table_columns', { table_name: 'tours' })
      );
      if (rpcError) throw rpcError;
      console.log('Tours schema RPC data:', rpcData);
      hasColumn = Array.isArray(rpcData) && rpcData.some((col: any) => col.column_name === 'show_in_provider');
    } catch (rpcError) {
      console.warn("get_table_columns RPC failed for tours, falling back to information_schema:", rpcError);
      try {
        const { data: schemaData, error: schemaError } = await fetchWithRetry(async () =>
          supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_schema', 'public')
            .eq('table_name', 'tours')
            .eq('column_name', 'show_in_provider')
        );
        if (schemaError) throw schemaError;
        console.log('Tours schema information_schema data:', schemaData);
        hasColumn = schemaData.length > 0;
      } catch (schemaError) {
        console.error("Error checking tours schema:", schemaError);
        toast.error("Failed to verify tours schema.");
        return;
      }
    }
    schemaCache.tours = hasColumn;
    setHasShowInProviderTours(hasColumn);
  };

  const fetchOrders = async () => {
    if (hasShowInProviderOrders === null) return;
    setLoading(true);
    console.log('fetchOrders: hasShowInProviderOrders =', hasShowInProviderOrders);

    let initialQuery = supabase
      .from('orders')
      .select(`
        id,
        user_id,
        tour_id,
        phone,
        last_name,
        first_name,
        email,
        age,
        gender,
        tour,
        passport_number,
        passport_expire,
        passport_copy,
        commission,
        created_by,
        edited_by,
        edited_at,
        travel_choice,
        status,
        hotel,
        room_number,
        payment_method,
        created_at,
        updated_at,
        departureDate,
        total_price,
        total_amount,
        paid_amount,
        balance,
        show_in_provider,
        createdBy,
        passengers!order_id(id,name,age,gender,passport_number,passport_expire),
        users!created_by(email),
        booking_confirmations(id,bus_number,guide_name,weather_emergency,updated_by,updated_at)
      `)
      .in('status', ['confirmed', 'pending']);

    if (hasShowInProviderOrders) {
      initialQuery = initialQuery.eq('show_in_provider', true);
    }

    try {
      const { data, error } = await fetchWithRetry(async () => await initialQuery);
      if (error) {
        console.error('fetchOrders error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('No data from initial query, trying without joins');
        toast.warn('No orders found, attempting fallback query.');
        let fallbackQuery = supabase
          .from('orders')
          .select(`
            id,
            user_id,
            tour_id,
            phone,
            last_name,
            first_name,
            email,
            age,
            gender,
            tour,
            passport_number,
            passport_expire,
            passport_copy,
            commission,
            created_by,
            edited_by,
            edited_at,
            travel_choice,
            status,
            hotel,
            room_number,
            payment_method,
            created_at,
            updated_at,
            departureDate,
            total_price,
            total_amount,
            paid_amount,
            balance,
            show_in_provider,
            createdBy,
            booking_confirmations(id,bus_number,guide_name,weather_emergency,updated_by,updated_at)
          `)
          .in('status', ['confirmed', 'pending']);
        if (hasShowInProviderOrders) {
          fallbackQuery = fallbackQuery.eq('show_in_provider', true);
        }
        const { data: fallbackData, error: fallbackError } = await fetchWithRetry(async () => await fallbackQuery);
        if (fallbackError) {
          console.error('fetchOrders fallback error details:', JSON.stringify(fallbackError, null, 2));
          throw fallbackError;
        }
        console.log('fetchOrders: Fallback query succeeded, data:', fallbackData);
        const ordersWithTotals: Order[] = (fallbackData as RawOrder[]).map((order: RawOrder) => ({
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
          passport_expire: order.passport_expire ?? null,
          passport_copy: order.passport_copy ?? null,
          commission: order.commission ?? null,
          created_by: order.created_by ? String(order.created_by) : null,
          edited_by: order.edited_by ? String(order.edited_by) : null,
          edited_at: order.edited_at ?? null,
          travel_choice: order.travel_choice ?? '',
          status: order.status as OrderStatus,
          hotel: order.hotel ?? null,
          room_number: order.room_number ?? null,
          payment_method: order.payment_method ?? null,
          created_at: order.created_at,
          updated_at: order.updated_at,
          departureDate: order.departureDate ?? '',
          createdBy: order.createdBy ?? (order.created_by ? String(order.created_by) : null),
          total_price: order.total_price,
          total_amount: order.total_amount,
          paid_amount: order.paid_amount,
          balance: order.balance,
          show_in_provider: hasShowInProviderOrders ? (order.show_in_provider ?? true) : true,
          order_id: String(order.id),
          passenger_count: order.first_name ? 1 : 0,
          booking_confirmation: order.booking_confirmations
            ? {
              order_id: String(order.id),
              bus_number: order.booking_confirmations.bus_number ?? null,
              guide_name: order.booking_confirmations.guide_name ?? null,
              weather_emergency: order.booking_confirmations.weather_emergency ?? null,
              updated_by: order.booking_confirmations.updated_by ?? null,
              updated_at: order.booking_confirmations.updated_at ?? null,
            }
            : null,
          passport_copy_url: null,
        }));
        setOrders(ordersWithTotals);
        return;
      }

      const ordersWithTotals: Order[] = (data as RawOrder[]).map((order: RawOrder) => ({
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
        passport_expire: order.passport_expire ?? null,
        passport_copy: order.passport_copy ?? null,
        commission: order.commission ?? null,
        created_by: order.created_by ? String(order.created_by) : null,
        edited_by: order.edited_by ? String(order.edited_by) : null,
        edited_at: order.edited_at ?? null,
        travel_choice: order.travel_choice ?? '',
        status: order.status as OrderStatus,
        hotel: order.hotel ?? null,
        room_number: order.room_number ?? null,
        payment_method: order.payment_method ?? null,
        created_at: order.created_at,
        updated_at: order.updated_at,
        departureDate: order.departureDate ?? '',
        createdBy: order.users?.email ?? (order.createdBy ?? (order.created_by ? String(order.created_by) : null)),
        total_price: order.total_price,
        total_amount: order.total_amount,
        paid_amount: order.paid_amount,
        balance: order.balance,
        show_in_provider: hasShowInProviderOrders ? (order.show_in_provider ?? true) : true,
        order_id: String(order.id),
        passenger_count: order.passengers?.length || (order.first_name ? 1 : 0),
        booking_confirmation: order.booking_confirmations
          ? {
            order_id: String(order.id),
            bus_number: order.booking_confirmations.bus_number ?? null,
            guide_name: order.booking_confirmations.guide_name ?? null,
            weather_emergency: order.booking_confirmations.weather_emergency ?? null,
            updated_by: order.booking_confirmations.updated_by ?? null,
            updated_at: order.booking_confirmations.updated_at ?? null,
          }
          : null,
        passport_copy_url: null,
      }));

      setOrders(ordersWithTotals);
    } catch (error) {
      console.error('Error fetching orders:', JSON.stringify(error, null, 2));
      toast.error('Failed to fetch orders!');
    } finally {
      setLoading(false);
    }
  };

  const fetchCreatorEmails = async () => {
    try {
      const toursWithEmails = await Promise.all(
        tours.map(async (tour) => {
          if (tour.created_by && !tour.creator_name) {
            const { data, error } = await fetchWithRetry(async () =>
              supabase
                .from('users')
                .select('email')
                .eq('id', tour.created_by)
                .single()
            );
            return {
              ...tour,
              creator_name: error ? 'Unknown Creator' : data.email || 'Unknown Creator',
            };
          }
          return tour;
        })
      );
      setTours(toursWithEmails);
    } catch (error) {
      console.error('Error fetching creator emails:', error);
      toast.error('Failed to fetch creator emails.');
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const initialize = async () => {
      await Promise.all([checkOrdersSchema(), checkToursSchema()]);
      await fetchOrders();
      if (tours.some(tour => !tour.creator_name)) {
        await fetchCreatorEmails();
      }
    };

    initialize();
  }, []);

  // Periodically refresh session to prevent JWT expiration
  useEffect(() => {
    const interval = setInterval(async () => {
      await refreshSession();
    }, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found. Real-time subscriptions may fail.');
        toast.error('Please log in to enable real-time updates.');
      }
    };
    checkSession();
  }, []);

  useEffect(() => {
    if (hasShowInProviderOrders !== null && hasShowInProviderOrders && orders.length === 0) {
      fetchOrders();
    }
  }, [hasShowInProviderOrders]);

  useEffect(() => {
    if (hasShowInProviderOrders === null || hasShowInProviderTours === null) return;

    const setupSubscriptions = () => {
      const statuses = ['confirmed', 'pending'];
      const channels: any[] = [];

      statuses.forEach((status) => {
        const filter = hasShowInProviderOrders
          ? `status=eq.${status},show_in_provider=eq.true`
          : `status=eq.${status}`;
        const channel = supabase
          .channel(`provider_orders_${status}_${Math.random().toString(36).substring(2)}`)
          .on(
            'postgres_changes' as any,
            {
              event: '*',
              schema: 'public',
              table: 'orders',
              select: `
                id,
                user_id,
                tour_id,
                phone,
                last_name,
                first_name,
                email,
                age,
                gender,
                tour,
                passport_number,
                passport_expire,
                passport_copy,
                commission,
                created_by,
                edited_by,
                edited_at,
                travel_choice,
                status,
                hotel,
                room_number,
                payment_method,
                created_at,
                updated_at,
                departureDate,
                total_price,
                total_amount,
                paid_amount,
                balance,
                show_in_provider,
                createdBy,
                passengers!order_id(id,name,age,gender,passport_number,passport_expire),
                users!created_by(email),
                booking_confirmations(id,bus_number,guide_name,weather_emergency,updated_by,updated_at)
              `,
              filter,
            },
            (payload) => {
              if (payload.eventType === 'UPDATE') {
                if (hasShowInProviderOrders && payload.new.show_in_provider === false) {
                  setOrders((prev) => prev.filter((order) => order.id !== String(payload.new.id)));
                } else {
                  setOrders((prev) => {
                    const updatedOrders = prev.map((order) =>
                      order.id === String(payload.new.id)
                        ? {
                          ...order,
                          ...payload.new,
                          id: String(payload.new.id),
                          user_id: String(payload.new.user_id),
                          tour_id: String(payload.new.tour_id),
                          created_by: payload.new.created_by ? String(payload.new.created_by) : null,
                          edited_by: payload.new.edited_by ? String(payload.new.edited_by) : null,
                          passenger_count: payload.new.passengers?.length || (payload.new.first_name ? 1 : 0),
                          total_amount: payload.new.total_amount,
                          total_price: payload.new.total_price,
                          paid_amount: payload.new.paid_amount,
                          balance: payload.new.balance,
                          show_in_provider: hasShowInProviderOrders ? (payload.new.show_in_provider ?? true) : true,
                          createdBy: payload.new.users?.email ?? (payload.new.createdBy ?? (payload.new.created_by ? String(payload.new.created_by) : null)),
                          departureDate: payload.new.departureDate ?? '',
                          order_id: String(payload.new.id),
                          booking_confirmation: payload.new.booking_confirmations
                            ? {
                              order_id: String(payload.new.id),
                              bus_number: payload.new.booking_confirmations.bus_number ?? null,
                              guide_name: payload.new.booking_confirmations.guide_name ?? null,
                              weather_emergency: payload.new.booking_confirmations.weather_emergency ?? null,
                              updated_by: payload.new.booking_confirmations.updated_by ?? null,
                              updated_at: payload.new.booking_confirmations.updated_at ?? null,
                            }
                            : null,
                          passport_copy_url: null,
                        } as Order
                        : order
                    );
                    return updatedOrders;
                  });
                }
              } else if (payload.eventType === 'INSERT') {
                if (
                  ['confirmed', 'pending'].includes(payload.new.status) &&
                  (!hasShowInProviderOrders || payload.new.show_in_provider)
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
                      passport_expire: payload.new.passport_expire ?? null,
                      passport_copy: payload.new.passport_copy ?? null,
                      commission: payload.new.commission ?? null,
                      created_by: payload.new.created_by ? String(payload.new.created_by) : null,
                      edited_by: payload.new.edited_by ? String(payload.new.edited_by) : null,
                      edited_at: payload.new.edited_at ?? null,
                      travel_choice: payload.new.travel_choice ?? '',
                      status: payload.new.status as OrderStatus,
                      hotel: payload.new.hotel ?? null,
                      room_number: payload.new.room_number ?? null,
                      payment_method: payload.new.payment_method ?? null,
                      created_at: payload.new.created_at,
                      updated_at: payload.new.updated_at,
                      departureDate: payload.new.departureDate ?? '',
                      createdBy: payload.new.users?.email ?? (payload.new.createdBy ?? (payload.new.created_by ? String(payload.new.created_by) : null)),
                      total_price: payload.new.total_price,
                      total_amount: payload.new.total_amount,
                      paid_amount: payload.new.paid_amount,
                      balance: payload.new.balance,
                      show_in_provider: hasShowInProviderOrders ? (payload.new.show_in_provider ?? true) : true,
                      order_id: String(payload.new.id),
                      passenger_count: payload.new.passengers?.length || (payload.new.first_name ? 1 : 0),
                      booking_confirmation: payload.new.booking_confirmations
                        ? {
                          order_id: String(payload.new.id),
                          bus_number: payload.new.booking_confirmations.bus_number ?? null,
                          guide_name: payload.new.booking_confirmations.guide_name ?? null,
                          weather_emergency: payload.new.booking_confirmations.weather_emergency ?? null,
                          updated_by: payload.new.booking_confirmations.updated_by ?? null,
                          updated_at: payload.new.booking_confirmations.updated_at ?? null,
                        }
                        : null,
                      passport_copy_url: null,
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
              console.error(`Order subscription error (status=${status}):`, error);
              toast.error(`Real-time subscription failed: ${error.message}`);
              refreshSession();
            }
          });
        channels.push(channel);
      });

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
              departure_date,
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
            filter: hasShowInProviderTours ? 'show_in_provider=eq.true' : undefined,
          },
          (payload) => {
            const mapToTour = (data: any): Tour => ({
              id: String(data.id),
              title: data.title || 'Untitled Tour',
              name: data.name || 'Unknown Tour',
              departure_date: data.departure_date || data.departureDate || '1970-01-01',
              created_by: data.created_by || 'system',
              description: data.description || '',
              hotels: data.hotels || [],
              dates: data.dates || [],
              seats: Number(data.seats) || 0,
              status: data.status || 'active',
              show_in_provider: hasShowInProviderTours ? (data.show_in_provider ?? true) : null,
              services: data.services || [],
              base_price: data.base_price || 0,
              created_at: data.created_at || undefined,
              updated_at: data.updated_at || undefined,
              available_seats: data.available_seats || 0,
              price_base: data.price_base || undefined,
              creator_name:
                typeof data.creator_name === 'object'
                  ? data.creator_name?.email || 'Unknown Creator'
                  : data.creator_name || 'Unknown Creator',
              tour_number: data.tour_number || '0',
              booking_confirmation: data.booking_confirmation
                ? {
                  order_id: data.booking_confirmation.order_id || '',
                  bus_number: data.booking_confirmation.bus_number ?? null,
                  guide_name: data.booking_confirmation.guide_name ?? null,
                  weather_emergency: data.booking_confirmation.weather_emergency ?? null,
                  updated_by: data.booking_confirmation.updated_by ?? null,
                  updated_at: data.booking_confirmation.updated_at ?? null,
                }
                : null,
            });

            if (payload.eventType === 'UPDATE') {
              if (hasShowInProviderTours && payload.new.show_in_provider === false) {
                setTours((prev) => prev.filter((tour) => tour.id !== payload.new.id));
              } else {
                setTours((prev) => prev.map((tour) =>
                  tour.id === payload.new.id ? mapToTour(payload.new) : tour
                ));
              }
            } else if (payload.eventType === 'INSERT') {
              if (
                (!hasShowInProviderTours || payload.new?.show_in_provider) &&
                payload.new?.id &&
                payload.new?.title &&
                payload.new?.name &&
                payload.new?.departure_date &&
                payload.new?.created_by
              ) {
                setTours((prev) => [...prev, mapToTour(payload.new)]);
              }
            } else if (payload.eventType === 'DELETE') {
              setTours((prev) => prev.filter((tour) => tour.id !== String(payload.old.id)));
            }
          }
        )
        .subscribe((status, error) => {
          if (error) {
            console.error('Tour subscription error:', error);
            toast.error(`Real-time tour subscription failed: ${error.message}`);
            refreshSession();
          }
        });
      channels.push(tourSubscription);

      subscriptionRef.current = channels;
    };

    setupSubscriptions();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.forEach((channel: any) => supabase.removeChannel(channel));
      }
    };
  }, [hasShowInProviderOrders, hasShowInProviderTours, setTours]);

  const exportOrdersToCSV = async () => {
    if (filteredOrders.length === 0) {
      toast.warn('No orders to export!');
      return;
    }
    setExportLoading(true);
    try {
      const headers = [
        'Order ID', 'Tour', 'Departure Date', 'Passengers', 'Status',
        'Total Amount', 'Created By', 'Edited At', 'Payment Method',
        'Phone', 'First Name', 'Last Name', 'Email', 'Age', 'Gender',
        'Commission', 'Hotel', 'Room Number', 'Bus Number', 'Guide Name', 'Weather/Emergency',
      ];
      const csvRows = filteredOrders.map(order => [
        order.id,
        order.tour || 'N/A',
        order.departureDate ? new Date(order.departureDate).toLocaleDateString('en-US') : 'Not set',
        order.passenger_count,
        order.status,
        `${order.total_amount?.toFixed(2) || '0.00'}`,
        order.createdBy || order.created_by || 'N/A',
        order.edited_at ? new Date(order.edited_at).toLocaleDateString('en-US') : 'N/A',
        order.payment_method || 'N/A',
        order.phone || 'N/A',
        order.first_name || 'N/A',
        order.last_name || 'N/A',
        order.email || 'N/A',
        order.age || 'N/A',
        order.gender || 'N/A',
        order.commission ? `${order.commission.toFixed(2)}` : 'N/A',
        order.hotel || 'N/A',
        order.room_number || 'N/A',
        order.booking_confirmation?.bus_number || 'N/A',
        order.booking_confirmation?.guide_name || 'N/A',
        order.booking_confirmation?.weather_emergency || 'N/A',
      ]);
      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `provider-orders-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filteredOrders.length} orders to CSV!`);
    } catch (error) {
      console.error('Error exporting orders:', error);
      toast.error('Failed to export orders!');
    } finally {
      setExportLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const previousOrders = [...orders];
    const updatedOrders = orders.map((o) =>
      o.id === orderId
        ? { ...o, status, edited_by: currentUser.id, edited_at: new Date().toISOString() }
        : o
    );
    setOrders(updatedOrders);
    try {
      const { error } = await fetchWithRetry(async () =>
        supabase
          .from('orders')
          .update({ status, edited_by: currentUser.id, edited_at: new Date().toISOString() })
          .eq('id', orderId)
      );
      if (error) throw error;
      toast.success('Order status updated!');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update order status.');
      setOrders(previousOrders);
    }
  };

  const confirmedOrders = orders.filter((order) => {
    const include = ['confirmed', 'pending'].includes(order.status) && (!hasShowInProviderOrders || order.show_in_provider === true);
    return include;
  });

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

  const showNotification = (type: 'success' | 'error', message: string) => {
    toast[type](message);
  };

  // Enhanced Tab Navigation
  const tabs = [
    {
      id: 'orders' as const,
      label: 'Orders',
      icon: Users,
      color: 'blue'
    },
    {
      id: 'tours' as const,
      label: 'Tours',
      icon: MapPin,
      color: 'blue'
    },
    {
      id: 'booking' as const,
      label: 'Booking Confirmation',
      icon: CheckCircle,
      color: 'blue'
    },
    {
      id: 'addTour' as const,
      label: 'Tour Management',
      icon: Settings,
      color: 'blue'
    }
  ];

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { active: string; inactive: string }> = {
      blue: {
        active: 'border-blue-600 text-blue-600 bg-blue-50',
        inactive: 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
      },
    };
    return isActive ? colors[color].active : colors[color].inactive;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastContainer />
      <DashboardHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Enhanced Tab Navigation */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 py-3 px-5 rounded-lg text-sm font-semibold
                      transition-all duration-200 ease-in-out
                      ${isActive ? 'border-2 shadow-md transform scale-105' : 'border-2 border-transparent'}
                      ${getColorClasses(tab.color, isActive)}
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {activeTab === 'orders' && (
          <>
            <StatsCards orders={confirmedOrders} tours={tours.filter(t => !hasShowInProviderTours || t.show_in_provider)} />
            <OrdersTable
              orders={filteredOrders}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              loading={loading}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              ordersPerPage={ordersPerPage}
              updateOrderStatus={updateOrderStatus}
              exportOrdersToCSV={exportOrdersToCSV}
              exportLoading={exportLoading}
              uniqueDates={uniqueDates}
              formatDate={formatDate}
            />
          </>
        )}
        {activeTab === 'tours' && (
          <ToursGrid tours={tours.filter(t => !hasShowInProviderTours || t.show_in_provider)} formatDate={formatDate} />
        )}
        {activeTab === 'booking' && (
          <BookingConfirmationTab
            orders={filteredOrders}
            currentUser={currentUser}
            setOrders={setOrders}
            formatDate={formatDate}
          />
        )}
        {activeTab === 'addTour' && (
          <AddTourTab
            tours={tours.filter(t => !hasShowInProviderTours || t.show_in_provider)}
            setTours={setTours}
            currentUser={currentUser}
            showNotification={showNotification}
            hideProviderColumn={true}
          />
        )}
      </div>
    </div>
  );
}

export default ProviderInterface;