import { useState } from "react";
import { supabase } from "../supabaseClient";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
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
}

export default function AddTourTab({ tours, setTours, currentUser, showNotification }: AddTourTabProps) {
  const { currentUser: authUser } = useAuth();
  const userRole = authUser?.role || "user";
  const {
    filteredTours,
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
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
  } = useTours({ userRole, tours, setTours });

  const [newTour, setNewTour] = useState({
    title: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
    description: "",
  });

  // Function to handle template selection
  const handleSelectTemplate = (templateData: Partial<typeof newTour>) => {
    setNewTour((prev) => ({
      ...prev,
      ...templateData,
      departure_date: "", // Keep departure date empty for user input
      seats: "", // Keep seats empty for user input
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
    // Validate date format
    const parsedDate = new Date(newTour.departure_date);
    if (Number.isNaN(parsedDate.getTime())) {
      showNotification("error", "Invalid departure date format");
      return;
    }

    const seatsValue = newTour.seats ? parseInt(newTour.seats, 10) : 0;
    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      departure_date: newTour.departure_date,
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
          dates: [data.departure_date], // Ensure dates array is initialized
          base_price: data.base_price || 0,
          tour_number: data.tour_number || null,
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

      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            All Tours ({filteredTours.length})
          </h3>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Filter by title..."
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value as Tour["status"] | "" || "pending" || "active" || "inactive" || "full" || "hidden")}
              className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="full">Full</option>
              <option value="hidden">Hidden</option>
            </select>
            <div className="flex space-x-2">
              <input
                type="date"
                value={dateFilterStart}
                onChange={(e) => setDateFilterStart(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="date"
                value={dateFilterEnd}
                onChange={(e) => setDateFilterEnd(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {filteredTours.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-500">No tours available yet.</p>
              <p className="text-sm text-gray-400 mt-1">Add your first tour using the form above.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Tour #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Departure Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Show to Provider
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Seats
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      #{tour.tour_number || tour.id}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={tour.title}
                        onChange={(e) => handleTourChange(tour.id, "title", e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Tour title..."
                      />
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <input
                        type="text"
                        value={tour.name || ""}
                        onChange={(e) => handleTourChange(tour.id, "name", e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Tour name..."
                      />
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <input
                        type="date"
                        value={tour.departure_date || ""}
                        onChange={(e) => handleTourChange(tour.id, "departure_date", e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {tour.departure_date && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDisplayDate(tour.departure_date)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200 text-sm text-gray-900">
                      {tour.creator_name || "N/A"}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <select
                        value={tour.status || ""}
                        onChange={(e) => handleTourChange(tour.id, "status", e.target.value as Tour["status"])}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="full">Full</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      {tour.show_in_provider !== null && tour.show_in_provider !== undefined ? (
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={tour.show_in_provider}
                            onChange={(e) => handleTourChange(tour.id, "show_in_provider", e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-600">
                            {tour.show_in_provider ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-red-600" />
                            )}
                          </span>
                        </label>
                      ) : (
                        <span className="text-sm text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <input
                        type="number"
                        value={tour.seats || 0}
                        onChange={(e) => handleTourChange(tour.id, "seats", Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Seats..."
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {showDeleteConfirm === tour.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteTour(tour.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(tour.id)}
                          className="p-1 text-red-600 hover:text-red-800"
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
    </div>
  );
}