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
import {
  format,
  subMonths,
  addMonths,
  subWeeks,
  addWeeks,
  subDays,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  differenceInDays,
} from "date-fns";
import { useNotifications } from "../hooks/useNotifications";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyticsDashboardProps {
  currentUser: User;
  tours: Tour[];
  orders: Order[];
  passengers: Passenger[];
}

interface AnalyticsData {
  passengersByUser: { userId: string; username: string; count: number }[];
  toursByPopularity: { tourTitle: string; count: number }[];
  ordersByProvider: {
    providerId: string;
    providerName: string;
    count: number;
  }[];
}

export default function AnalyticsDashboard({
  tours,
  orders,
  passengers,
}: AnalyticsDashboardProps) {
  const { showNotification } = useNotifications();
  const [viewMode, setViewMode] = useState<
    "month" | "week" | "day" | "threeMonths" | "custom"
  >("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    passengersByUser: [],
    toursByPopularity: [],
    ordersByProvider: [],
  });
  const [loading, setLoading] = useState(false);

  // Determine date range based on view mode
  const getDateRange = () => {
    let start: Date, end: Date;
    switch (viewMode) {
      case "month":
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        end = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        break;
      case "week":
        start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
        break;
      case "day":
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
        break;
      case "threeMonths":
        start = subMonths(
          new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
          2
        );
        end = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        break;
      case "custom":
        if (!startDate || !endDate) {
          start = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1
          );
          end = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
            23,
            59,
            59
          );
        } else {
          start = startOfDay(startDate);
          end = endOfDay(endDate);
        }
        break;
      default:
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        end = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
          23,
          59,
          59
        );
    }
    return { start, end };
  };

  // Fetch analytics data for the selected date range
  const fetchAnalyticsData = async (start: Date, end: Date) => {
    setLoading(true);
    try {
      // Fetch users
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, username, email, first_name, last_name")
        .not("id", "is", null);
      if (usersError) throw new Error(usersError.message);

      // Filter passengers for the selected date range
      let filteredPassengers = passengers.filter((p) => {
        if (!p.created_at) return false;
        const passengerDate = new Date(p.created_at);
        return passengerDate >= start && passengerDate <= end;
      });

      // Fetch fresh passengers if none found in props
      if (filteredPassengers.length === 0) {
        const { data: freshPassengers, error: passengersError } = await supabase
          .from("passengers")
          .select("*, user_id, created_at, tour_title")
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());
        if (passengersError) throw new Error(passengersError.message);
        filteredPassengers = freshPassengers || [];
      }

      // Fetch orders for the selected date range
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          "*, tour: tours(title), created_by, show_in_provider, created_at"
        )
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      if (ordersError) throw new Error(ordersError.message);

      // Process passengers by user
      const passengersByUser = users
        .filter((user) => user.id)
        .map((user) => {
          const userId = String(user.id);
          const count = filteredPassengers.filter(
            (p) => String(p.user_id) === userId
          ).length;
          const displayName =
            user.username ||
            (user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`
              : user.email || `User ${userId.slice(-6)}`);
          return { userId, username: displayName, count };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      // Process tours by popularity
      const toursByPopularity = tours
        .filter((tour) => tour.title)
        .map((tour) => {
          const tourTitle = tour.title.toLowerCase().trim();
          const count = filteredPassengers.filter(
            (p) =>
              p.tour_title && p.tour_title.toLowerCase().trim() === tourTitle
          ).length;
          return { tourTitle: tour.title, count };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      // Process orders by provider
      const monthOrders = ordersData.filter(
        (order) => order.created_by && order.show_in_provider !== false
      );

      const ordersByProvider = users
        .filter((user) => user.id)
        .map((user) => {
          const userId = String(user.id);
          const count = monthOrders.filter(
            (o) => String(o.created_by) === userId
          ).length;
          const displayName =
            user.username ||
            (user.first_name && user.last_name
              ? `${user.first_name} ${user.last_name}`
              : user.email || `Provider ${userId.slice(-6)}`);
          return { providerId: userId, providerName: displayName, count };
        })
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      setAnalyticsData({
        passengersByUser,
        toursByPopularity,
        ordersByProvider,
      });
    } catch (error) {
      console.error("💥 Analytics fetch error:", error);
      showNotification(
        "error",
        `Failed to fetch analytics data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
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
    const { start, end } = getDateRange();
    fetchAnalyticsData(start, end);
  }, [currentDate, viewMode, startDate, endDate]);

  // Navigation handlers
  const handlePrevious = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(subDays(currentDate, 1));
        break;
      case "threeMonths":
        setCurrentDate(subMonths(currentDate, 3));
        break;
      case "custom":
        // No navigation for custom range
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case "month":
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case "week":
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case "day":
        setCurrentDate(addDays(currentDate, 1));
        break;
      case "threeMonths":
        setCurrentDate(addMonths(currentDate, 3));
        break;
      case "custom":
        // No navigation for custom range
        break;
    }
  };

  // Chart data (unchanged)
  const passengersByUserChartData = useMemo(
    () => ({
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
    }),
    [analyticsData.passengersByUser]
  );

  const toursByPopularityChartData = useMemo(
    () => ({
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
    }),
    [analyticsData.toursByPopularity]
  );

  const ordersByProviderChartData = useMemo(
    () => ({
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
    }),
    [analyticsData.ordersByProvider]
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: { font: { size: 12, family: "'Inter', sans-serif" } },
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
          font: { size: 12, family: "'Inter', sans-serif" },
        },
        grid: { color: "rgba(0, 0, 0, 0.05)" },
      },
      x: {
        ticks: {
          font: { size: 12, family: "'Inter', sans-serif" },
          maxRotation: 45,
          minRotation: 0,
        },
        grid: { display: false },
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
          font: { size: 12, family: "'Inter', sans-serif" },
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

  // Format display text for the selected date range
  const formatDateRange = () => {
    const { start, end } = getDateRange();
    if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy");
    } else if (viewMode === "week") {
      return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
    } else if (viewMode === "day") {
      return format(currentDate, "MMMM d, yyyy");
    } else if (viewMode === "threeMonths") {
      return `${format(start, "MMM yyyy")} - ${format(end, "MMM yyyy")}`;
    } else if (viewMode === "custom" && startDate && endDate) {
      return `${format(startDate, "MMM d, yyyy")} - ${format(
        endDate,
        "MMM d, yyyy"
      )}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[105rem] mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="mt-2 text-gray-600">
            Insights on passenger registrations, tour popularity, and provider
            orders
          </p>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            📊 Data for {formatDateRange()}
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="flex space-x-2">
              <select
                value={viewMode}
                onChange={(e) =>
                  setViewMode(
                    e.target.value as
                      | "month"
                      | "week"
                      | "day"
                      | "threeMonths"
                      | "custom"
                  )
                }
                className="px-4 py-2 bg-gray-100 text-gray-900 rounded-md font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Monthly</option>
                <option value="week">Weekly</option>
                <option value="day">Daily</option>
                <option value="threeMonths">3 Months</option>
                <option value="custom">Custom Range</option>
              </select>
              {viewMode !== "custom" && (
                <>
                  <button
                    onClick={handlePrevious}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-semibold text-sm transition-all duration-200 flex items-center"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-semibold text-sm transition-all duration-200 flex items-center"
                  >
                    Next →
                  </button>
                </>
              )}
            </div>
            {viewMode === "custom" && (
              <div className="flex gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Start Date:
                  </label>
                  <DatePicker
                    selected={startDate}
                    onChange={(date: Date | null) => setStartDate(date)}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    maxDate={endDate || new Date()}
                    className="px-4 py-2 bg-gray-100 text-gray-900 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    dateFormat="MMM d, yyyy"
                    placeholderText="Select start date"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    End Date:
                  </label>
                  <DatePicker
                    selected={endDate}
                    onChange={(date: Date | null) => setEndDate(date)}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate ? startDate : undefined}
                    maxDate={new Date()}
                    className="px-4 py-2 bg-gray-100 text-gray-900 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    dateFormat="MMM d, yyyy"
                    placeholderText="Select end date"
                  />
                </div>
              </div>
            )}
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
                  {analyticsData.passengersByUser.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}{" "}
                  total
                </span>
              </h3>
              <div className="h-80 relative">
                {analyticsData.passengersByUser.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-center">
                      No passenger registrations for this period.
                    </p>
                    <p className="text-sm mt-1">
                      Try a different period or check your data.
                    </p>
                  </div>
                ) : (
                  <Bar
                    data={passengersByUserChartData}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>

            {/* Tours by Popularity */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                🗺️ Most Popular Tours
                <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {analyticsData.toursByPopularity.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}{" "}
                  total
                </span>
              </h3>
              <div className="h-80 relative">
                {analyticsData.toursByPopularity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">🗺️</span>
                    </div>
                    <p className="text-center">No tour data for this period.</p>
                    <p className="text-sm mt-1">
                      Ensure passengers are assigned to tours.
                    </p>
                  </div>
                ) : (
                  <Pie
                    data={toursByPopularityChartData}
                    options={pieChartOptions}
                  />
                )}
              </div>
            </div>

            {/* Orders by Provider */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                📋 Orders Received by Provider
                <span className="ml-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {analyticsData.ordersByProvider.reduce(
                    (sum, item) => sum + item.count,
                    0
                  )}{" "}
                  total
                </span>
              </h3>
              <div className="h-80 relative">
                {analyticsData.ordersByProvider.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">📋</span>
                    </div>
                    <p className="text-center">
                      No provider order data for this period.
                    </p>
                    <p className="text-sm mt-1">
                      Check your order visibility settings.
                    </p>
                  </div>
                ) : (
                  <Bar
                    data={ordersByProviderChartData}
                    options={chartOptions}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
