import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Plus, Trash2, Search, Eye, EyeOff } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useTours } from "../hooks/useTours";
import type { Tour } from "../types/type";
import { useAuth } from "../context/AuthProvider";

interface ToursTabProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
}

export default function ToursTab({ tours, setTours }: ToursTabProps) {
  const { currentUser } = useAuth(); // Get userRole from auth context
  const userRole = currentUser?.role || "user";

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
    handleDeleteTour,
    formatDisplayDate,
    viewFilter,
    setViewFilter,
  } = useTours({ userRole, tours, setTours });

  const [newTourTitle, setNewTourTitle] = useState("");
  const [newTourName, setNewTourName] = useState("");
  const [newTourDepartureDate, setNewTourDepartureDate] = useState("");

  const handleAddTour = async () => {
    if (!newTourTitle.trim() || !newTourName.trim() || !newTourDepartureDate) {
      toast.error("Please provide a title, name, and departure date for the new tour.");
      return;
    }

    const newTour: Omit<Tour, "id" | "created_at" | "updated_at" | "created_by" | "creator_name" | "tour_number"> = {
      title: newTourTitle.trim(),
      name: newTourName.trim(),
      departure_date: newTourDepartureDate,
      description: "",
      hotels: [],
      dates: [],
      seats: 0,
      status: "active",
      show_in_provider: true,
      services: [],
      base_price: 0,
      available_seats: 0,
      price_base: undefined,
      booking_confirmation: null,
    };

    try {
      const { data: user } = await supabase.auth.getUser();
      const created_by = user?.user?.id || "system";

      // Fetch username or email for creator_name
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("username, email")
        .eq("id", created_by)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
      }

      const creator_name = userData?.username || userData?.email || created_by;
      const insertData: any = {
        ...newTour,
        created_by,
        tour_number: null,
        departuredate: newTour.departure_date,
      };

      delete insertData.departureDate;

      // Check if show_in_provider column exists
      const { data: schemaData, error: schemaError } = await supabase
        .rpc("get_table_columns", { table_name: "tours" });
      if (schemaError) {
        console.error("Error checking schema:", schemaError);
        toast.error(`Failed to verify schema: ${schemaError.message}`);
        return;
      }
      const hasShowInProvider = schemaData.some((col: any) => col.column_name === "show_in_provider");
      if (!hasShowInProvider) {
        console.warn("show_in_provider column not found in tours table. Omitting from insert.");
        delete insertData.show_in_provider;
      }

      console.log("Adding tour with data:", insertData);
      const { data, error } = await supabase
        .from("tours")
        .insert([insertData])
        .select("*, users!tours_created_by_fkey(username, email)")
        .single();

      if (error) {
        console.error("Error adding tour:", error);
        toast.error(`Failed to add tour: ${error.message}`);
        return;
      }

      if (data) {
        setTours((prev) => [
          ...prev,
          {
            ...data,
            id: String(data.id),
            tour_number: data.tour_number || null,
            created_by: data.created_by || "system",
            creator_name: data.users?.username || data.users?.email || data.created_by || "Unknown",
            seats: Number(data.seats) || 0,
            show_in_provider: hasShowInProvider ? (data.show_in_provider ?? true) : null,
            description: data.description || "",
            hotels: data.hotels || [],
            dates: data.dates || [],
            services: data.services || [],
            base_price: data.base_price || 0,
            available_seats: data.available_seats || 0,
            departureDate: data.departuredate, // Map back to camelCase for TS
          } as Tour,
        ]);
        setNewTourTitle("");
        setNewTourName("");
        setNewTourDepartureDate("");
        toast.success("Tour added successfully!");
      }
    } catch (error) {
      console.error("Unexpected error adding tour:", error);
      toast.error("Unexpected error adding tour.");
    }
  };

  // Rest of the component remains unchanged
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ToastContainer />
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Manage Tours</h2>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
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
                Tour Name
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
            {filteredTours.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-center text-gray-500">
                  No tours found.
                </td>
              </tr>
            ) : (
              filteredTours.map((tour) => {
                console.log(`Rendering tour ${tour.id}, show_in_provider: ${tour.show_in_provider}`);
                return (
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
                        value={tour.name}
                        onChange={(e) => handleTourChange(tour.id, "name", e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Tour name..."
                      />
                    </td>
                    <td className="px-4 py-3 border-r border-gray-200">
                      <input
                        type="date"
                        value={tour.departure_date}
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
                        value={tour.status}
                        onChange={(e) =>
                          handleTourChange(tour.id, "status", e.target.value as Tour["status"])
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
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
                            onChange={(e) => {
                              const newValue = e.target.checked;
                              console.log(`Toggling show_in_provider for tour ${tour.id} to: ${newValue}`);
                              handleTourChange(tour.id, "show_in_provider", newValue)
                                .then(() => {
                                  console.log(`Successfully toggled show_in_provider to ${newValue} for tour ${tour.id}`);
                                })
                                .catch((error) => {
                                  console.error(`Error toggling show_in_provider for tour ${tour.id}:`, error);
                                  toast.error(`Failed to update show in provider: ${error.message}`);
                                });
                            }}
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
                        value={tour.seats}
                        onChange={(e) => handleTourChange(tour.id, "seats", Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Seats..."
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}