import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import type { User, Tour, Order, Passenger } from "../types/type";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { format, subMonths, addMonths } from "date-fns";
import { useNotifications } from "../hooks/useNotifications";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface AnalyticsDashboardProps {
  currentUser: User;
  tours: Tour[];
  orders: Order[];
  passengers: Passenger[];
}

interface AnalyticsData {
  passengersByUser: { userId: string; username: string; count: number }[];
  toursByPopularity: { tourTitle: string; count: number }[];
  ordersByProvider: { providerId: string; providerName: string; count: number }[];
}

export default function AnalyticsDashboard({tours, orders, passengers }: AnalyticsDashboardProps) {
  const { showNotification } = useNotifications();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    passengersByUser: [],
    toursByPopularity: [],
    ordersByProvider: [],
  });
  const [loading, setLoading] = useState(false);

  // Fetch analytics data for the selected month
  const fetchAnalyticsData = async (month: Date) => {
    setLoading(true);
    try {
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);

      // Debug: Log input data
      console.log("🚀 Tours prop:", tours);
      console.log("🚀 Orders prop:", orders);
      console.log("🚀 Passengers prop:", passengers);

      // Fetch users for passenger registration data - make sure we get valid IDs
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, email, first_name, last_name")
        .not("id", "is", null); // Only get users with valid IDs
      if (usersError) throw new Error(usersError.message);
      
      console.log("👥 Fetched users:", users);
      console.log("👥 Users with valid IDs:", users.filter(u => u.id));

      // Filter passengers for the selected month from the prop OR fetch fresh
      let monthPassengers = passengers.filter((p) => {
        if (!p.created_at) return false;
        const passengerDate = new Date(p.created_at);
        return passengerDate >= startOfMonth && passengerDate <= endOfMonth;
      });

      // If no passengers from prop, fetch fresh data
      if (monthPassengers.length === 0) {
        const { data: freshPassengers, error: passengersError } = await supabase
          .from("passengers")
          .select("*, user_id, created_at, tour_title")
          .gte("created_at", startOfMonth.toISOString())
          .lte("created_at", endOfMonth.toISOString());
        if (passengersError) throw new Error(passengersError.message);
        monthPassengers = freshPassengers || [];
      }

      // Fetch orders for the selected month
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*, tour: tours(title), created_by, show_in_provider, created_at")
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());
      if (ordersError) throw new Error(ordersError.message);

      // Debug: Log fetched data
      console.log("✈️ Month passengers:", monthPassengers);
      console.log("📦 Month orders:", ordersData);
      console.log("🔍 Passenger user_ids:", monthPassengers.map(p => ({ id: p.user_id, created_at: p.created_at })));

      // Process passengers by user - FIXED VERSION
      const passengersByUser = users
        .filter(user => user.id) // Only users with valid IDs
        .map((user) => {
          const userId = String(user.id); // Ensure string comparison
          const count = monthPassengers.filter((p) => {
            const passengerUserId = String(p.user_id);
            return passengerUserId === userId;
          }).length;

          const displayName = user.username || 
            (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 
             user.email || `User ${userId.slice(-6)}`);

          console.log(`🔗 Matching ${displayName} (ID: ${userId}): ${count} passengers`);

          return {
            userId,
            username: displayName,
            count,
          };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count); // Sort by count descending

      // Process tours by popularity - FIXED VERSION
      const toursByPopularity = tours
        .filter(tour => tour.title) // Only tours with titles
        .map((tour) => {
          const tourTitle = tour.title.toLowerCase().trim();
          const count = monthPassengers.filter((p) => {
            return p.tour_title && 
                   p.tour_title.toLowerCase().trim() === tourTitle;
          }).length;

          console.log(`🗺️ Tour "${tour.title}" has ${count} passengers`);

          return {
            tourTitle: tour.title,
            count,
          };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      // Process orders by provider - FIXED VERSION
      const monthOrders = ordersData.filter(order => 
        order.created_by && 
        order.show_in_provider !== false // Include orders where show_in_provider is true or null
      );

      const ordersByProvider = users
        .filter(user => user.id) // Only users with valid IDs
        .map((user) => {
          const userId = String(user.id);
          const count = monthOrders.filter((o) => 
            String(o.created_by) === userId
          ).length;

          const displayName = user.username || 
            (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : 
             user.email || `Provider ${userId.slice(-6)}`);

          console.log(`📋 Provider ${displayName} (ID: ${userId}): ${count} orders`);

          return {
            providerId: userId,
            providerName: displayName,
            count,
          };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      console.log("📊 Final passengersByUser:", passengersByUser);
      console.log("📊 Final toursByPopularity:", toursByPopularity);
      console.log("📊 Final ordersByProvider:", ordersByProvider);

      setAnalyticsData({
        passengersByUser,
        toursByPopularity,
        ordersByProvider,
      });
    } catch (error) {
      console.error("💥 Analytics fetch error:", error);
      showNotification("error", `Failed to fetch analytics data: ${error instanceof Error ? error.message : "Unknown error"}`);
      // Set empty data on error to prevent crashes
      setAnalyticsData({
        passengersByUser: [],
        toursByPopularity: [],
        ordersByProvider: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData(currentMonth);
  }, [currentMonth]);

  // Chart data for passengers by user
  const passengersByUserChartData = useMemo(() => ({
    labels: analyticsData.passengersByUser.map((item) => item.username),
    datasets: [
      {
        label: "Passengers Registered",
        data: analyticsData.passengersByUser.map((item) => item.count),
        backgroundColor: "rgba(59, 130, 246, 0.6)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1,
      },
    ],
  }), [analyticsData.passengersByUser]);

  // Chart data for tours by popularity
  const toursByPopularityChartData = useMemo(() => ({
    labels: analyticsData.toursByPopularity.map((item) => item.tourTitle),
    datasets: [
      {
        label: "Passenger Count",
        data: analyticsData.toursByPopularity.map((item) => item.count),
        backgroundColor: [
          "rgba(34, 197, 94, 0.6)",
          "rgba(249, 115, 22, 0.6)",
          "rgba(239, 68, 68, 0.6)",
          "rgba(168, 85, 247, 0.6)",
          "rgba(59, 130, 246, 0.6)",
          "rgba(16, 185, 129, 0.6)",
          "rgba(245, 158, 11, 0.6)",
        ],
        borderColor: [
          "rgba(34, 197, 94, 1)",
          "rgba(249, 115, 22, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(168, 85, 247, 1)",
          "rgba(59, 130, 246, 1)",
          "rgba(16, 185, 129, 1)",
          "rgba(245, 158, 11, 1)",
        ],
        borderWidth: 1,
      },
    ],
  }), [analyticsData.toursByPopularity]);

  // Chart data for orders by provider
  const ordersByProviderChartData = useMemo(() => ({
    labels: analyticsData.ordersByProvider.map((item) => item.providerName),
    datasets: [
      {
        label: "Orders Received",
        data: analyticsData.ordersByProvider.map((item) => item.count),
        backgroundColor: "rgba(168, 85, 247, 0.6)",
        borderColor: "rgba(168, 85, 247, 1)",
        borderWidth: 1,
      },
    ],
  }), [analyticsData.ordersByProvider]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
        },
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        ticks: {
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          maxRotation: 45,
          minRotation: 0,
        },
        grid: {
          display: false,
        },
      },
    },
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right" as const,
        labels: {
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
      },
    },
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">Insights on passenger registrations, tour popularity, and provider orders</p>
        </div>

        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            📊 Data for {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={handlePreviousMonth}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-semibold text-sm transition-all duration-200 flex items-center"
            >
              ← Previous
            </button>
            <button
              onClick={handleNextMonth}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-semibold text-sm transition-all duration-200 flex items-center"
            >
              Next →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-2xl p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-900">Loading analytics data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Passengers by User */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                👥 Passengers Registered by User
                <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {analyticsData.passengersByUser.reduce((sum, item) => sum + item.count, 0)} total
                </span>
              </h3>
              <div className="h-80 relative">
                {analyticsData.passengersByUser.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-center">No passenger registrations for this month.</p>
                    <p className="text-sm mt-1">Try a different month or check your data.</p>
                  </div>
                ) : (
                  <Bar data={passengersByUserChartData} options={chartOptions} />
                )}
              </div>
            </div>

            {/* Tours by Popularity */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                🗺️ Most Popular Tours
                <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {analyticsData.toursByPopularity.reduce((sum, item) => sum + item.count, 0)} total
                </span>
              </h3>
              <div className="h-80 relative">
                {analyticsData.toursByPopularity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">🗺️</span>
                    </div>
                    <p className="text-center">No tour data for this month.</p>
                    <p className="text-sm mt-1">Ensure passengers are assigned to tours.</p>
                  </div>
                ) : (
                  <Pie data={toursByPopularityChartData} options={pieChartOptions} />
                )}
              </div>
            </div>

            {/* Orders by Provider */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                📋 Orders Received by Provider
                <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {analyticsData.ordersByProvider.reduce((sum, item) => sum + item.count, 0)} total
                </span>
              </h3>
              <div className="h-80 relative">
                {analyticsData.ordersByProvider.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">📋</span>
                    </div>
                    <p className="text-center">No provider order data for this month.</p>
                    <p className="text-sm mt-1">Check your order visibility settings.</p>
                  </div>
                ) : (
                  <Bar data={ordersByProviderChartData} options={chartOptions} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}