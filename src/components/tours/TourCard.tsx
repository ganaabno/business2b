// src/components/tours/TourCard.tsx
import {
  Edit2,
  Trash2,
  Save,
  X,
  Eye,
  MapPin,
  Calendar,
  Users,
  DollarSign,
} from "lucide-react";
import { formatDate } from "../../utils/tourUtils";
import { getImageSrc } from "../../utils/imageUtils";
import ImageSelector from "./ImageSelector";
import VisibilityToggle from "./VisibilityToggle";
import type { Tour, TourFormData } from "../../types/type";

type Status = "active" | "inactive" | "full" | "completed";

interface TourCardProps {
  tour: Tour;
  isEditing: boolean;
  editForm: TourFormData;
  setEditForm: React.Dispatch<React.SetStateAction<TourFormData>>;
  onSave: () => void;
  onCancel: () => void;
  onEdit: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDelete: () => void;
  showDeleteConfirm: boolean;
  onStatusChange: (id: string, status: Status) => Promise<void>;
}

export default function TourCard({
  tour,
  isEditing,
  editForm,
  setEditForm,
  onSave,
  onCancel,
  onEdit,
  onDeleteConfirm,
  onDeleteCancel,
  onDelete,
  showDeleteConfirm,
  onStatusChange,
}: TourCardProps) {
  const imgSrc = getImageSrc(tour.image_key);
  const booked = (tour.seats ?? 0) - (tour.available_seats ?? 0);
  const percent =
    tour.seats && tour.seats > 0 ? (booked / tour.seats) * 100 : 0;

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl border p-4 space-y-3">
        <input
          placeholder="Title *"
          value={editForm.title || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, title: e.target.value }))
          }
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={editForm.departure_date || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, departure_date: e.target.value }))
          }
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          placeholder="Seats"
          value={editForm.seats || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, seats: e.target.value }))
          }
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={editForm.base_price || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, base_price: e.target.value }))
          }
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={editForm.status || "active"}
          onChange={(e) => {
            const newStatus = e.target.value as Status;
            setEditForm((f) => ({ ...f, status: newStatus }));
            onStatusChange(tour.id, newStatus);
          }}
          className="w-full px-2 py-1 border rounded bg-yellow-50 text-sm font-medium"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="full">Full</option>
          <option value="completed">Completed</option>
        </select>

        <div className="space-y-2">
          <ImageSelector
            value={editForm.image_key || ""}
            onChange={(k) => setEditForm((f) => ({ ...f, image_key: k }))}
          />
          {editForm.image_key && (
            <img
              src={getImageSrc(editForm.image_key)}
              alt="preview"
              className="h-32 w-full object-cover rounded border"
            />
          )}
        </div>

        <textarea
          placeholder="Hotels (comma-separated)"
          value={editForm.hotels || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, hotels: e.target.value }))
          }
          rows={2}
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <textarea
          placeholder="Services (comma-separated)"
          value={editForm.services || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, services: e.target.value }))
          }
          rows={2}
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <textarea
          placeholder="Description"
          value={editForm.description || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={3}
          className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 resize-none"
        />

        <VisibilityToggle
          showToUser={editForm.show_to_user ?? true}
          showInProvider={editForm.show_in_provider ?? true}
          onUserChange={(v) => setEditForm((f) => ({ ...f, show_to_user: v }))}
          onProviderChange={(v) =>
            setEditForm((f) => ({ ...f, show_in_provider: v }))
          }
        />

        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="flex-1 bg-green-600 text-white py-1 rounded flex items-center justify-center hover:bg-green-700 transition"
          >
            <Save className="w-4 h-4 mr-1" /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-400 text-white py-1 rounded flex items-center justify-center hover:bg-gray-500 transition"
          >
            <X className="w-4 h-4 mr-1" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      <div className="relative h-48 bg-gray-200">
        <img
          src={imgSrc}
          alt={tour.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition" />
        <div className="absolute top-2 right-2 flex gap-1">
          {tour.show_to_user && (
            <Eye className="w-5 h-5 text-green-600 bg-white/80 rounded-full p-1" />
          )}
          {tour.show_in_provider && (
            <Eye className="w-5 h-5 text-blue-600 bg-white/80 rounded-full p-1" />
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
            #{tour.tour_number || tour.id.slice(0, 3)}
          </span>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
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
        </div>
      </div>

      <div className="p-5 space-y-3">
        <h4 className="text-lg font-bold text-gray-900 flex items-center group-hover:text-blue-600 transition">
          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
          {tour.title || "Unnamed Tour"}
        </h4>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-blue-500" />
            <span className="text-sm text-gray-600">Departure</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {formatDate(tour.departure_date || "")}
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

        {tour.base_price != null && tour.base_price > 0 && (
          <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-purple-600" />
              <span className="text-xs text-gray-600">Price</span>
            </div>
            <span className="text-sm font-bold text-purple-700">
              ${tour.base_price.toFixed(2)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <div className="text-left">
            <p className="text-xs text-gray-500 mb-1">Created by</p>
            <p className="text-sm font-medium text-gray-900">
              {tour.creator_name || "N/A"}
            </p>
          </div>
          <div className="text-right">
            {showDeleteConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={onDelete}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                >
                  Confirm
                </button>
                <button
                  onClick={onDeleteCancel}
                  className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={onEdit}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onDeleteConfirm}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              tour.status === "full"
                ? "bg-red-500"
                : "bg-gradient-to-r from-blue-500 to-indigo-600"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Booked: {booked}</span>
          <span>{Math.round(percent)}% full</span>
        </div>
      </div>
    </div>
  );
}
