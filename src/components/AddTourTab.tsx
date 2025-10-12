import { useState } from "react";
import { supabase } from "../supabaseClient";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Plus, Trash2, Eye, EyeOff, Clock, User, MapPin, Users, Bus, Calendar, CloudRain } from "lucide-react";
import type { Tour, User as UserType } from "../types/type";
import { formatDate } from "../utils/tourUtils";
import SanyaTemplate from "../Templates/SanyaTemplate";
import ShanghaiTemplate from "../Templates/ShanghaiTemplate";
import { useTours } from "../hooks/useTours";
import { useAuth } from "../context/AuthProvider";

interface AddTourTabProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
  hideProviderColumn?: boolean;
}

export default function AddTourTab({ tours, setTours, currentUser, showNotification, hideProviderColumn = false }: AddTourTabProps) {
  const { currentUser: authUser } = useAuth();
  const [statusFilter, setStatusFilter] = useState<Tour["status"] | "">("");
  const userRole = authUser?.role || "user";
  const {
    filteredTours,
    titleFilter,
    setTitleFilter,
    dateFilterStart,
    setDateFilterStart,
    dateFilterEnd,
    setDateFilterEnd,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleTourChange,
    formatDisplayDate,
    viewFilter,
    setViewFilter,
    refreshTours,
  } = useTours({ userRole, tours, setTours });

  console.log("Filtered Tours:", filteredTours.map(t => ({
    id: t.id,
    title: t.title,
    departure_date: t.departure_date,
    booking_confirmation: t.booking_confirmation,
  })));

  const [newTour, setNewTour] = useState({
    title: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
    description: "",
  });

  const handleSelectTemplate = (templateData: Partial<typeof newTour>) => {
    setNewTour((prev) => ({
      ...prev,
      ...templateData,
      departure_date: "",
      seats: "",
    }));
    showNotification("success", `Template ${templateData.title} loaded! Please set departure date and seats.`);
  };

  const handleAddTour = async () => {
    if (!newTour.title.trim()) {
      showNotification("error", "Tour title is required");
      return;
    }
    if (!newTour.departure_date) {
      showNotification("error", "Departure date is required");
      return;
    }
    const parsedDate = new Date(newTour.departure_date);
    if (Number.isNaN(parsedDate.getTime())) {
      showNotification("error", "Invalid departure date format");
      return;
    }

    const seatsValue = newTour.seats ? parseInt(newTour.seats, 10) : 0;
    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      departuredate: newTour.departure_date,
      seats: seatsValue,
      available_seats: seatsValue,
      hotels: newTour.hotels.trim() ? newTour.hotels.trim().split(",").map((h) => h.trim()) : [],
      services: newTour.services.trim()
        ? newTour.services.trim().split(",").map((s) => ({ name: s.trim(), price: 0 }))
        : [],
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active" as Tour["status"],
      show_in_provider: true,
      creator_name: currentUser.username || currentUser.email || currentUser.id,
      base_price: 0,
    };

    try {
      const { data, error } = await supabase.from("tours").insert([tourData]).select().single();
      if (error) {
        console.error("Supabase error:", error);
        showNotification("error", `Error adding tour: ${error.message}`);
        return;
      }

      setTours([
        ...tours,
        {
          ...data,
          id: String(data.id),
          creator_name: tourData.creator_name,
          seats: Number(data.seats) || 0,
          available_seats: Number(data.available_seats) || 0,
          show_in_provider: data.show_in_provider ?? true,
          hotels: data.hotels || [],
          services: data.services || [],
          description: data.description || "",
          dates: [data.departuredate],
          base_price: data.base_price || 0,
          tour_number: data.tour_number || null,
          departure_date: data.departuredate,
          name: data.title,
          booking_confirmation: null,
        } as Tour,
      ]);
      setNewTour({
        title: "",
        departure_date: "",
        seats: "",
        hotels: "",
        services: "",
        description: "",
      });
      showNotification("success", "Tour added successfully!");
    } catch (error) {
      console.error("Error adding tour:", error);
      showNotification("error", "An unexpected error occurred while adding the tour.");
    }
  };

  const handleDeleteTour = async (id: string) => {
    const previousTours = [...tours];
    setTours(tours.filter((t) => t.id !== id));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", id);
      if (error) {
        console.error("Error deleting tour:", error);
        showNotification("error", `Failed to delete tour: ${error.message}`);
        setTours(previousTours);
      } else {
        showNotification("success", "Tour deleted successfully");
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting tour:", error);
      showNotification("error", "An unexpected error occurred while deleting the tour.");
      setTours(previousTours);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <ToastContainer />
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Add New Tour
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newTour.title}
              onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
              placeholder="Enter tour title..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={newTour.departure_date}
              onChange={(e) => setNewTour({ ...newTour, departure_date: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newTour.seats}
              onChange={(e) => setNewTour({ ...newTour, seats: e.target.value })}
              placeholder="Number of seats"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotels (comma-separated)</label>
            <input
              type="text"
              placeholder="Hotel A, Hotel B, Hotel C"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newTour.hotels}
              onChange={(e) => setNewTour({ ...newTour, hotels: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Services</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={newTour.services}
              onChange={(e) => setNewTour({ ...newTour, services: e.target.value })}
              placeholder="Tour services..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              value={newTour.description}
              onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
              rows={3}
              placeholder="Tour description..."
            />
          </div>
        </div>
        <div className="flex justify-end mt-6 space-x-4">
          <button
            onClick={handleAddTour}
            disabled={!newTour.title || !newTour.departure_date}
            className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tour
          </button>
          <SanyaTemplate onSelect={handleSelectTemplate} />
          <ShanghaiTemplate onSelect={handleSelectTemplate} />
        </div>
      </div>

      <div className="space-y-8">
        {/* Tours Table Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-slate-100 p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 flex items-center">
              <MapPin className="w-6 h-6 mr-3 text-blue-600" />
              All Tours
              <span className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full">
                {filteredTours.length}
              </span>
            </h3>

            {/* Filters */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by title..."
                  value={titleFilter}
                  onChange={(e) => setTitleFilter(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Tour["status"] | "")}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="hidden">Hidden</option>
                <option value="full">Full</option>
              </select>

              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateFilterStart}
                  onChange={(e) => setDateFilterStart(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
                <input
                  type="date"
                  value={dateFilterEnd}
                  onChange={(e) => setDateFilterEnd(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {filteredTours.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <MapPin className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 text-lg font-medium">No tours available yet</p>
                <p className="text-sm text-gray-400 mt-2">Add your first tour using the form above</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tour #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Departure Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    {!hideProviderColumn && (
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Provider
                      </th>
                    )}
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Seats
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredTours.map((tour) => (
                    <tr key={tour.id} className="hover:bg-blue-50 transition-colors duration-150">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        #{tour.tour_number || tour.id}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={tour.title}
                          onChange={(e) => handleTourChange(tour.id, "title", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Tour title..."
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={tour.name || ""}
                          onChange={(e) => handleTourChange(tour.id, "name", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Tour name..."
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          value={tour.departure_date || ""}
                          onChange={(e) => handleTourChange(tour.id, "departure_date", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        />
                        {tour.departure_date && (
                          <div className="text-xs text-gray-500 mt-1 font-medium">
                            {formatDisplayDate(tour.departure_date)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                        {tour.creator_name || "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={tour.status || ""}
                          onChange={(e) => handleTourChange(tour.id, "status", e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                          <option value="">Select Status</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="full">Full</option>
                          <option value="hidden">Hidden</option>
                        </select>
                      </td>
                      {!hideProviderColumn && (
                        <td className="px-6 py-4">
                          {tour.show_in_provider !== null && tour.show_in_provider !== undefined ? (
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={tour.show_in_provider}
                                onChange={(e) => handleTourChange(tour.id, "show_in_provider", e.target.checked)}
                                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                              />
                              <span className="text-sm">
                                {tour.show_in_provider ? (
                                  <Eye className="w-5 h-5 text-green-600" />
                                ) : (
                                  <EyeOff className="w-5 h-5 text-red-600" />
                                )}
                              </span>
                            </label>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={tour.seats || 0}
                          onChange={(e) => handleTourChange(tour.id, "seats", Number(e.target.value))}
                          className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="0"
                          min="0"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {showDeleteConfirm === tour.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDeleteTour(tour.id)}
                              className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(tour.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete tour"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Confirmed Bookings Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                <svg className="w-6 h-6 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
                Confirmed Bookings
                <span className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded-full">
                  {filteredTours.filter((tour) => tour.booking_confirmation).length}
                </span>
              </h3>
              <button
                onClick={refreshTours}
                className="px-5 py-2.5 bg-sky-600 text-white font-medium rounded-xl hover:bg-sky-700 transition-all shadow-sm hover:shadow-md flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="p-6">
            {filteredTours.filter((tour) => tour.booking_confirmation).length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 text-lg font-medium">No confirmed bookings yet</p>
                <p className="text-sm text-gray-400 mt-2">Bookings will appear here once confirmed</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredTours
                  .filter((tour) => tour.booking_confirmation)
                  .map((tour) => (
                    <div
                      key={tour.id}
                      className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden"
                    >
                      <div className="bg-blue-500 p-4">
                        <h4 className="text-lg font-bold text-white truncate">
                          {tour.title}
                        </h4>
                        <p className="text-blue-100 text-sm mt-1">
                          Tour #{tour.tour_number || tour.id}
                        </p>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start space-x-3">
                          <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 font-medium uppercase">Departure Date</p>
                            <p className="text-sm text-gray-900 font-semibold">
                              {tour.departure_date ? formatDisplayDate(tour.departure_date) : "Not set"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <Users className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 font-medium uppercase">Passengers</p>
                            <p className="text-sm text-gray-900 font-semibold">
                              {tour.booking_confirmation?.passenger_count ?? tour.seats ?? "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <Bus className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 font-medium uppercase">Bus Number</p>
                            <p className="text-sm text-gray-900 font-semibold">
                              {tour.booking_confirmation?.bus_number || "Not assigned"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <User className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 font-medium uppercase">Guide Name</p>
                            <p className="text-sm text-gray-900 font-semibold truncate">
                              {tour.booking_confirmation?.guide_name || "Not assigned"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-3">
                          <CloudRain className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 font-medium uppercase">Weather/Emergency</p>
                            <p className="text-sm text-gray-900 font-semibold">
                              {tour.booking_confirmation?.weather_emergency || "Normal conditions"}
                            </p>
                          </div>
                        </div>
                        <div className="pt-3 mt-3 border-t border-gray-200">
                          <div className="flex items-start space-x-3 mb-2">
                            <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500">Created by</p>
                              <p className="text-sm text-gray-700 font-medium truncate">
                                {tour.creator_name || "Unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3 mb-2">
                            <User className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500">Updated by</p>
                              <p className="text-sm text-gray-700 font-medium truncate">
                                {tour.booking_confirmation?.updated_by_username ||
                                  tour.booking_confirmation?.updated_by_email || "Unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-3">
                            <Clock className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500">Last updated</p>
                              <p className="text-sm text-gray-700 font-medium">
                                {tour.booking_confirmation?.updated_at
                                  ? formatDisplayDate(tour.booking_confirmation.updated_at)
                                  : "Unknown"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}