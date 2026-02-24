// EditableToursGrid.tsx
import { useState } from "react";
import { MapPin, Calendar, Users, Edit2, X, Save, Check } from "lucide-react";
import type { Tour } from "../types/type";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/tourUtils";

interface EditableToursGridProps {
  tours: Tour[];
  onUpdate: (tourId: string, updates: Partial<Tour>) => Promise<void>;
}

const IMAGE_OPTIONS = [
  { value: null, label: "Auto (by title)" },
  { value: "Bali.jpg", label: "Bali" },
  { value: "Bangkok.jpg", label: "Bangkok" },
  { value: "Dalian.jpg", label: "Dalian" },
  { value: "HaLongBay.jpg", label: "Ha Long Bay" },
  { value: "HoChinMinh.jpg", label: "Ho Chi Minh" },
  { value: "Japan.jpg", label: "Japan" },
  { value: "NhaTrang.jpg", label: "Nha Trang" },
  { value: "Phuquoc.jpg", label: "Phu Quoc" },
  { value: "Sanya.jpg", label: "Sanya" },
  { value: "Shanghai.jpg", label: "Shanghai" },
  { value: "Singapore.jpg", label: "Singapore" },
  { value: "ThailandPucket.jpg", label: "Phuket" },
  { value: "Turkey.jpg", label: "Turkey" },
  { value: "Zhangjiajie.jpg", label: "Zhangjiajie" },
  { value: "default.jpg", label: "Default" },
];

const getImageUrl = (imageKey: string | null) =>
  imageKey ? `/src/assets/tours/${imageKey}` : `/src/assets/tours/default.jpg`;

export default function EditableToursGrid({
  tours,
  onUpdate,
}: EditableToursGridProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Tour>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (tour: Tour) => {
    setEditingId(tour.id);
    setEditData({
      title: tour.title,
      departure_date: tour.departure_date,
      seats: tour.seats,
      available_seats: tour.available_seats,
      base_price: tour.base_price,
      status: tour.status,
      image_key: tour.image_key,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    await onUpdate(editingId, editData);
    setSaving(false);
    cancelEdit();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tours.map((tour) => {
        const isEditing = editingId === tour.id;
        const imageUrl = getImageUrl(
          editData.image_key ?? tour.image_key ?? null
        );

        return (
          <div
            key={tour.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group relative"
          >
            {/* Edit/Save Buttons */}
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              {isEditing ? (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => startEdit(tour)}
                  className="p-2 bg-blue-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Image */}
            <div className="relative h-48 bg-gray-100">
              <img
                src={imageUrl}
                alt={tour.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = getImageUrl("default.jpg");
                }}
              />
              {isEditing && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                  <select
                    value={editData.image_key ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditData({
                        ...editData,
                        image_key: val === "" ? null : val,
                      });
                    }}
                    className="w-full max-w-xs px-3 py-2 bg-white text-gray-900 rounded-lg"
                  >
                    {IMAGE_OPTIONS.map((opt) => (
                      <option key={opt.value ?? "auto"} value={opt.value ?? ""}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5 space-y-3">
              {/* Title */}
              {isEditing ? (
                <input
                  type="text"
                  value={editData.title || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, title: e.target.value })
                  }
                  className="w-full text-lg font-bold text-gray-900 border-b-2 border-blue-500 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h4 className="text-lg font-bold text-gray-900 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  {tour.title || "Unnamed Tour"}
                </h4>
              )}

              {/* Departure */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="text-sm text-gray-600">
                    {t("departure")}
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="date"
                    value={editData.departure_date || ""}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        departure_date: e.target.value,
                      })
                    }
                    className="text-sm font-semibold text-gray-900 bg-white px-2 py-1 rounded border"
                  />
                ) : (
                  <span className="text-sm font-semibold text-gray-900">
                    {formatDisplayDate(tour.departure_date ?? undefined)}
                  </span>
                )}
              </div>

              {/* Seats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-green-500" />
                    <span className="text-xs text-gray-600">
                      {t("totalSeats")}
                    </span>
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.seats || 0}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          seats: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-16 text-sm font-bold text-green-700 bg-white px-2 py-1 rounded border"
                    />
                  ) : (
                    <span className="text-sm font-bold text-green-700">
                      {tour.seats || 0}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-blue-500" />
                    <span className="text-xs text-gray-600">
                      {t("availableSeats")}
                    </span>
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.available_seats || 0}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          available_seats: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-16 text-sm font-bold text-blue-700 bg-white px-2 py-1 rounded border"
                    />
                  ) : (
                    <span className="text-sm font-bold text-blue-700">
                      {tour.available_seats || 0}
                    </span>
                  )}
                </div>
              </div>

              {/* Price & Status */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="text-left">
                  <p className="text-xs text-gray-500 mb-1">{t("basePrice")}</p>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editData.base_price || 0}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          base_price: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-20 text-lg font-bold text-indigo-600 bg-white px-2 py-1 rounded border"
                    />
                  ) : (
                    <p className="text-lg font-bold text-indigo-600">
                      ${tour.base_price?.toFixed(2) || "0.00"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">{t("status")}</p>
                  {isEditing ? (
                    <select
                      value={editData.status || "active"}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          status: e.target.value as Tour["status"],
                        })
                      }
                      className="text-sm font-medium bg-white px-2 py-1 rounded border"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="full">Full</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  ) : (
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        tour.status === "active"
                          ? "bg-green-100 text-green-800"
                          : tour.status === "full"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {t(tour.status || "inactive")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Progress */}
            <div className="px-5 pb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (editData.seats || tour.seats || 0) > 0
                        ? (((editData.seats || tour.seats || 0) -
                            (editData.available_seats ||
                              tour.available_seats ||
                              0)) /
                            (editData.seats || tour.seats || 0)) *
                          100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>
                  {t("booked")}:{" "}
                  {(editData.seats || tour.seats || 0) -
                    (editData.available_seats || tour.available_seats || 0)}
                </span>
                <span>
                  {t("percentFull", {
                    percent:
                      (editData.seats || tour.seats || 0) > 0
                        ? Math.round(
                            (((editData.seats || tour.seats || 0) -
                              (editData.available_seats ||
                                tour.available_seats ||
                                0)) /
                              (editData.seats || tour.seats || 0)) *
                              100
                          )
                        : 0,
                  })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
