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

const getSourceLabel = (sourceTag?: Tour["source_tag"]) => {
  if (sourceTag === "global") return "Global";
  if (sourceTag === "global+local") return "Global + Local";
  return "Local";
};
  
const getSourceClassName = (sourceTag?: Tour["source_tag"]) => {
  if (sourceTag === "global") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (sourceTag === "global+local") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  return "bg-gray-100 text-gray-700 border-gray-200";
};

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
      <div className="mono-card p-4 space-y-3">
        <input
          placeholder="Title *"
          value={editForm.title || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, title: e.target.value }))
          }
          className="mono-input mono-input--sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="Country"
            value={editForm.country || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, country: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Genre"
            value={editForm.genre || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, genre: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Duration Day"
            value={editForm.duration_day || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, duration_day: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Duration Night"
            value={editForm.duration_night || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, duration_night: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Group Size"
            value={editForm.group_size || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, group_size: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Main Hotel"
            value={editForm.hotel || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, hotel: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Country Temp"
            value={editForm.country_temperature || ""}
            onChange={(e) =>
              setEditForm((f) => ({
                ...f,
                country_temperature: e.target.value,
              }))
            }
            className="mono-input mono-input--sm"
          />
          <input
            placeholder="Airlines (comma-separated)"
            value={editForm.airlines || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, airlines: e.target.value }))
            }
            className="mono-input mono-input--sm"
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(editForm.is_featured)}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, is_featured: e.target.checked }))
            }
          />
          Featured Tour
        </label>
        <input
          type="date"
          value={editForm.departure_date || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, departure_date: e.target.value }))
          }
          className="mono-input mono-input--sm"
        />
        <input
          type="number"
          placeholder="Seats"
          value={editForm.seats || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, seats: e.target.value }))
          }
          className="mono-input mono-input--sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price"
          value={editForm.base_price || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, base_price: e.target.value }))
          }
          className="mono-input mono-input--sm"
        />

        <select
          value={editForm.status || "active"}
          onChange={(e) => {
            const newStatus = e.target.value as Status;
            setEditForm((f) => ({ ...f, status: newStatus }));
            onStatusChange(tour.id, newStatus);
          }}
          className="mono-select mono-input--sm text-sm font-medium"
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
              loading="lazy"
              decoding="async"
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
          className="mono-input mono-input--sm resize-none"
        />
        <textarea
          placeholder="Services (comma-separated)"
          value={editForm.services || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, services: e.target.value }))
          }
          rows={2}
          className="mono-input mono-input--sm resize-none"
        />
        <textarea
          placeholder="Description"
          value={editForm.description || ""}
          onChange={(e) =>
            setEditForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={3}
          className="mono-input mono-input--sm resize-none"
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
            className="mono-button mono-button--sm flex-1"
          >
            <Save className="w-4 h-4 mr-1" /> Save
          </button>
          <button
            onClick={onCancel}
            className="mono-button mono-button--ghost mono-button--sm flex-1"
          >
            <X className="w-4 h-4 mr-1" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mono-card mono-card--hover overflow-hidden group">
      <div className="relative h-48 bg-gray-200">
        <img
          src={imgSrc}
          alt={tour.title}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent opacity-0 group-hover:opacity-100 transition" />
        <div className="absolute top-2 right-2 flex gap-1">
          {tour.show_to_user && (
            <Eye className="w-5 h-5 text-green-600 bg-white/80 rounded-full p-1" />
          )}
          {tour.show_in_provider && (
            <Eye className="w-5 h-5 text-blue-600 bg-white/80 rounded-full p-1" />
          )}
        </div>
      </div>

      <div className="bg-gray-100 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-700 text-sm font-semibold bg-white px-3 py-1 rounded-full border border-gray-200">
            #{tour.tour_number || tour.id.slice(0, 3)}
          </span>
          <span
            className={`mono-badge ${
              tour.status === "active"
                ? "mono-badge--success"
                : tour.status === "inactive"
                  ? ""
                  : tour.status === "full"
                    ? "mono-badge--danger"
                    : "mono-badge--warning"
            }`}
          >
            {tour.status || "active"}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        <h4 className="mono-title text-lg text-gray-900 flex items-center transition">
          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
          {tour.title || "Unnamed Tour"}
        </h4>
        {(tour.country || tour.genre) && (
          <p className="text-sm text-gray-600">
            {[tour.country, tour.genre].filter(Boolean).join(" • ")}
          </p>
        )}
        <div>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${getSourceClassName(
              tour.source_tag,
            )}`}
          >
            {getSourceLabel(tour.source_tag)}
          </span>
          {tour.is_featured && (
            <span className="inline-flex items-center ml-2 px-2.5 py-0.5 rounded-full border text-xs font-medium bg-amber-100 text-amber-700 border-amber-200">
              Featured
            </span>
          )}
        </div>

        {(tour.duration_day || tour.group_size) && (
          <div className="flex gap-2 flex-wrap">
            {tour.duration_day && (
              <span className="mono-badge mono-badge--warning">
                {tour.duration_day} day
              </span>
            )}
            {tour.duration_night && (
              <span className="mono-badge">
                {tour.duration_night} night
              </span>
            )}
            {tour.group_size && (
              <span className="mono-badge mono-badge--success">
                Group {tour.group_size}
              </span>
            )}
          </div>
        )}

        <div className="mono-panel flex items-center justify-between p-3 rounded-lg">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-blue-500" />
            <span className="text-sm text-gray-600">Departure</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {formatDate(tour.departure_date || "")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="mono-panel flex items-center justify-between p-3 rounded-lg">
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-2 text-green-500" />
              <span className="text-xs text-gray-600">Total</span>
            </div>
            <span className="text-sm font-bold text-green-700">
              {tour.seats || 0}
            </span>
          </div>
          <div className="mono-panel flex items-center justify-between p-3 rounded-lg">
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
          <div className="mono-panel flex items-center justify-between p-3 rounded-lg">
            <div className="flex items-center">
              <DollarSign className="w-4 h-4 mr-2 text-gray-700" />
              <span className="text-xs text-gray-600">Price</span>
            </div>
            <span className="text-sm font-bold text-gray-900">
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
                  className="mono-button mono-button--sm px-3 py-1"
                >
                  Confirm
                </button>
                <button
                  onClick={onDeleteCancel}
                  className="mono-button mono-button--ghost mono-button--sm px-3 py-1"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={onEdit}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onDeleteConfirm}
                  className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
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
            className={`h-2 rounded-full transition-all ${tour.status === "full" ? "bg-red-500" : "bg-gray-700"}`}
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
