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

export default function AnalyticsDashboard({ currentUser, tours, orders, passengers }: AnalyticsDashboardProps) {
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
      console.log("Tours prop:", tours);
      console.log("Passengers prop:", passengers);
      console.log("Orders prop:", orders);

      // Fetch users for passenger registration data
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, email, first_name, last_name");
      if (usersError) throw new Error(usersError.message);

      // Fetch passengers for the selected month
      const { data: passengersData, error: passengersError } = await supabase
        .from("passengers")
        .select("*")
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());
      if (passengersError) throw new Error(passengersError.message);

      // Fetch orders for the selected month
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*, tour: tours(title)")
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());
      if (ordersError) throw new Error(ordersError.message);

      // Debug: Log fetched data
      console.log("Fetched users:", users);
      console.log("Fetched passengers:", passengersData);
      console.log("Fetched orders:", ordersData);

      // Process passengers by user
      const passengersByUser = users.map((user) => ({
        userId: user.id,
        username: user.username || `${user.first_name} ${user.last_name}` || user.email,
        count: passengersData.filter((p) => p.user_id === user.id).length,
      })).filter((item) => item.count > 0);

      // Process tours by popularity with case-insensitive matching
      const toursByPopularity = tours.map((tour) => ({
        tourTitle: tour.title,
        count: passengersData.filter((p) =>
          p.tour_title?.toLowerCase() === tour.title.toLowerCase()
        ).length,
      })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);

      // Debug: Log toursByPopularity
      console.log("Tours by popularity:", toursByPopularity);

      // Process orders by provider
      const ordersByProvider = users.map((user) => ({
        providerId: user.id,
        providerName: user.username || `${user.first_name} ${user.last_name}` || user.email,
        count: ordersData.filter((o) => o.created_by === user.id && o.show_in_provider).length,
      })).filter((item) => item.count > 0);

      setAnalyticsData({
        passengersByUser,
        toursByPopularity,
        ordersByProvider,
      });
    } catch (error) {
      showNotification("error", `Failed to fetch analytics data: ${error instanceof Error ? error.message : "Unknown error"}`);
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
        ],
        borderColor: [
          "rgba(34, 197, 94, 1)",
          "rgba(249, 115, 22, 1)",
          "rgba(239, 68, 68, 1)",
          "rgba(168, 85, 247, 1)",
          "rgba(59, 130, 246, 1)",
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
            Data for {format(currentMonth, "MMMM yyyy")}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={handlePreviousMonth}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-semibold text-sm transition-all duration-200"
            >
              Previous Month
            </button>
            <button
              onClick={handleNextMonth}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-semibold text-sm transition-all duration-200"
            >
              Next Month
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-900">Loading analytics data...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Passengers by User */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Passengers Registered by User</h3>
              <div className="h-80">
                {analyticsData.passengersByUser.length === 0 ? (
                  <p className="text-gray-500 text-center">No passenger data for this month.</p>
                ) : (
                  <Bar data={passengersByUserChartData} options={chartOptions} />
                )}
              </div>
            </div>

            {/* Tours by Popularity */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Popular Tours</h3>
              <div className="h-80">
                {analyticsData.toursByPopularity.length === 0 ? (
                  <p className="text-gray-500 text-center">No tour data for this month. Ensure passengers are assigned to tours.</p>
                ) : (
                  <Pie data={toursByPopularityChartData} options={pieChartOptions} />
                )}
              </div>
            </div>

            {/* Orders by Provider */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders Received by Provider</h3>
              <div className="h-80">
                {analyticsData.ordersByProvider.length === 0 ? (
                  <p className="text-gray-500 text-center">No provider order data for this month.</p>
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