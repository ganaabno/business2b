import React, { useState, useMemo } from "react";
import {
  Edit2,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Calendar,
  Users,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { getImageSrc } from "../utils/imageUtils";
import ImageSelector from "../components/tours/ImageSelector";
import VisibilityToggle from "../components/tours/VisibilityToggle";
import type { Tour, TourFormData } from "../types/type";

type Status = "active" | "inactive" | "full" | "completed";

interface ToursTableProps {
  tours: Tour[];
  onSave: (tourId: string, data: TourFormData) => Promise<void>;
  onDelete: (tourId: string) => Promise<void>;
  onStatusChange: (id: string, status: Status) => Promise<void>;
}

export default function ToursTable({
  tours,
  onSave,
  onDelete,
  onStatusChange,
}: ToursTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TourFormData>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // FILTERS
  const [searchTitle, setSearchTitle] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredTours = useMemo(() => {
    return tours.filter((tour) => {
      const matchesTitle = tour.title
        ?.toLowerCase()
        .includes(searchTitle.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || tour.status === statusFilter;
      const tourDate = tour.departure_date;

      const matchesDateFrom = !dateFrom || (tourDate && tourDate >= dateFrom);
      const matchesDateTo = !dateTo || (tourDate && tourDate <= dateTo);

      return (
        (matchesTitle ?? true) &&
        matchesStatus &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [tours, searchTitle, statusFilter, dateFrom, dateTo]);

  const startEdit = (tour: Tour) => {
    setEditingId(tour.id);
    setEditForm({
      title: tour.title || "",
      departure_date: tour.departure_date || "",
      seats: tour.seats?.toString() || "",
      available_seats: tour.available_seats?.toString() || "",
      base_price: tour.base_price?.toString() || "",
      status: (tour.status as Status) || "active",
      image_key: tour.image_key || "",
      hotels: Array.isArray(tour.hotels) ? tour.hotels.join(", ") : "",
      services: Array.isArray(tour.services) ? tour.services.join(", ") : "",
      description: tour.description || "",
      show_to_user: tour.show_to_user ?? true,
      show_in_provider: tour.show_in_provider ?? true,
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await onSave(editingId, editForm as TourFormData);
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save tour!");
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "dd.MM.yyyy");
    } catch {
      return dateStr;
    }
  };

  const booked = (tour: Tour) =>
    (tour.seats ?? 0) - (tour.available_seats ?? 0);
  const percent = (tour: Tour) =>
    tour.seats && tour.seats > 0 ? (booked(tour) / tour.seats) * 100 : 0;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* HEADER + FILTERS */}
      <div className="p-6 border-b bg-gray-50 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">All Tours</h2>
          <div className="text-sm text-gray-600">
            {filteredTours.length} of {tours.length} tours
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="full">Full</option>
            <option value="completed">Completed</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full mono-table">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Tour
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                <Calendar className="w-4 h-4 inline mr-1" />
                Departure
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                <Users className="w-4 h-4 inline mr-1" />
                Seats
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Visibility
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTours.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-500">
                  No tours found
                </td>
              </tr>
            ) : (
              filteredTours.map((tour) => {
                const isEditing = editingId === tour.id;
                const isDeleting = deletingId === tour.id;

                return (
                  <tr key={tour.id} className="hover:bg-gray-50">
                    {/* TOUR NAME + IMAGE */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <ImageSelector
                            value={editForm.image_key || ""}
                            onChange={(k) =>
                              setEditForm((f) => ({ ...f, image_key: k }))
                            }
                          />
                        ) : (
                          <img
                            src={getImageSrc(tour.image_key)}
                            alt={tour.title}
                            className="w-12 h-12 rounded-lg object-cover border shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              value={editForm.title || ""}
                              onChange={(e) =>
                                setEditForm((f) => ({
                                  ...f,
                                  title: e.target.value,
                                }))
                              }
                              className="font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none w-full text-base"
                              placeholder="Tour title"
                            />
                          ) : (
                            <>
                              <div className="font-semibold text-gray-900 truncate">
                                {tour.title || "Untitled Tour"}
                              </div>
                              <div className="text-xs text-gray-500">
                                #{tour.tour_number || tour.id.slice(0, 6)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* DEPARTURE – ALWAYS VISIBLE, EDITABLE INLINE */}
                    <td className="px-6 py-4 text-sm font-medium">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.departure_date || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              departure_date: e.target.value,
                            }))
                          }
                          className="text-sm bg-transparent border-b-2 border-blue-500 focus:outline-none w-32"
                        />
                      ) : (
                        <span className="inline-block w-32">
                          {formatDate(tour.departure_date || "")}
                        </span>
                      )}
                    </td>

                    {/* SEATS */}
                    <td className="px-6 py-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={editForm.seats || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                seats: e.target.value,
                              }))
                            }
                            className="w-14 text-center bg-transparent border-b-2 border-blue-500 focus:outline-none text-sm"
                            placeholder="0"
                          />
                          <span className="text-gray-500 text-sm">/</span>
                          <input
                            type="number"
                            value={editForm.available_seats || ""}
                            onChange={(e) =>
                              setEditForm((f) => ({
                                ...f,
                                available_seats: e.target.value,
                              }))
                            }
                            className="w-14 text-center bg-transparent border-b-2 border-blue-500 focus:outline-none text-sm"
                            placeholder="0"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="font-bold text-base">
                            {tour.seats || 0}
                          </div>
                          <div className="text-xs text-gray-500">
                            {tour.available_seats || 0} free
                          </div>
                          <div className="w-20 mx-auto bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                percent(tour) >= 100
                                  ? "bg-red-500"
                                  : "bg-green-500"
                              }`}
                              style={{
                                width: `${Math.min(percent(tour), 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* PRICE */}
                    <td className="px-6 py-4 text-center font-bold text-green-600">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.base_price || ""}
                          onChange={(e) =>
                            setEditForm((f) => ({
                              ...f,
                              base_price: e.target.value,
                            }))
                          }
                          className="w-20 text-center bg-transparent border-b-2 border-blue-500 focus:outline-none font-bold"
                        />
                      ) : (
                        `$${tour.base_price?.toFixed(2) || "—"}`
                      )}
                    </td>

                    {/* STATUS */}
                    <td className="px-6 py-4 text-center">
                      {isEditing ? (
                        <select
                          value={editForm.status || "active"}
                          onChange={(e) => {
                            const val = e.target.value as Status;
                            setEditForm((f) => ({ ...f, status: val }));
                            onStatusChange(tour.id, val);
                          }}
                          className="text-xs font-bold px-2 py-1 rounded border bg-white"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="full">Full</option>
                          <option value="completed">Completed</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${
                            tour.status === "active"
                              ? "bg-green-100 text-green-800"
                              : tour.status === "inactive"
                              ? "bg-gray-100 text-gray-800"
                              : tour.status === "full"
                              ? "bg-red-100 text-red-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {tour.status || "active"}
                        </span>
                      )}
                    </td>

                    {/* VISIBILITY */}
                    <td className="px-6 py-4 text-center">
                      {isEditing ? (
                        <VisibilityToggle
                          showToUser={editForm.show_to_user ?? true}
                          showInProvider={editForm.show_in_provider ?? true}
                          onUserChange={(v) =>
                            setEditForm((f) => ({ ...f, show_to_user: v }))
                          }
                          onProviderChange={(v) =>
                            setEditForm((f) => ({ ...f, show_in_provider: v }))
                          }
                        />
                      ) : (
                        <div className="flex justify-center gap-3">
                          {tour.show_to_user ? (
                            <Eye className="w-5 h-5 text-green-600" />
                          ) : (
                            <EyeOff className="w-5 h-5 text-gray-400" />
                          )}
                          {tour.show_in_provider ? (
                            <Eye className="w-5 h-5 text-blue-600" />
                          ) : (
                            <EyeOff className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSave}
                              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition shadow-sm"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(tour)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {isDeleting ? (
                              <>
                                <button
                                  onClick={async () => {
                                    await onDelete(tour.id);
                                    setDeletingId(null);
                                  }}
                                  className="px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingId(null)}
                                  className="px-3 py-1.5 bg-gray-300 text-gray-700 text-xs rounded"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setDeletingId(tour.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
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
