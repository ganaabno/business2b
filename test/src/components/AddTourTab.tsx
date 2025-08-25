import { useState } from "react";
import { supabase } from "../supabaseClient";
import type { Tour, User as UserType } from "../types/type";
import { formatDate } from "../utils/tourUtils";

interface AddTourTabProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function AddTourTab({ tours, setTours, currentUser, showNotification }: AddTourTabProps) {
  const [newTour, setNewTour] = useState({
    title: "",
    name: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
    description: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleAddTour = async () => {
    if (!newTour.departure_date) {
      showNotification("error", "Departure date is required");
      return;
    }
    if (!newTour.title.trim()) {
      showNotification("error", "Tour title is required");
      return;
    }

    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      dates: newTour.departure_date ? [newTour.departure_date] : [],
      seats: newTour.seats ? parseInt(newTour.seats, 10) : null,
      hotels: newTour.hotels.trim() ? newTour.hotels.trim().split(",").map((h) => h.trim()) : [],
      services: newTour.services.trim()
        ? newTour.services.trim().split(",").map((s) => ({ name: s.trim(), price: 0 }))
        : [],
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active",
    };

    try {
      const { data, error } = await supabase.from("tours").insert([tourData]).select().single();
      if (error) {
        console.error("Supabase error:", error);
        showNotification("error", `Error adding tour: ${error.message}`);
        return;
      }

      setTours([...tours, data as Tour]);
      setNewTour({
        title: "",
        name: "",
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
    <div className="space-y-6">
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
              min="1"
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
        <div className="flex justify-end mt-6">
          <button
            onClick={handleAddTour}
            disabled={!newTour.title || !newTour.departure_date}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Tour
          </button>
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
            All Tours ({tours.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          {tours.length === 0 ? (
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure Date</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{tour.title}</div>
                      {tour.name && tour.name !== tour.title && (
                        <div className="text-xs text-gray-500 mt-1">📛 {tour.name}</div>
                      )}
                      <div className="text-sm text-gray-500 mt-1">{tour.description || "No description"}</div>
                      {tour.hotels && tour.hotels.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">🏨 {tour.hotels.join(", ")}</div>
                      )}
                      {tour.services && tour.services.length > 0 && (
                        <div className="text-xs text-green-600 mt-1">
                          {tour.services.map((service, idx) => (
                            <div key={idx}>
                              🔧 {service.name} (${service.price})
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(tour.dates?.[0])}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        💺 {tour.seats ?? "No limit"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          tour.status === "active"
                            ? "bg-green-100 text-green-800"
                            : tour.status === "inactive"
                            ? "bg-gray-100 text-gray-800"
                            : tour.status === "full"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {tour.status === "active"
                          ? "✅ Active"
                          : tour.status === "inactive"
                          ? "⏸️ Inactive"
                          : tour.status === "full"
                          ? "🚫 Full"
                          : "📍 " + (tour.status || "Active")}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {showDeleteConfirm === tour.id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteTour(tour.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(tour.id)}
                          className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                          title="Delete tour"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
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