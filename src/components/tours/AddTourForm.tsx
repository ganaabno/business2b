import { Plus } from "lucide-react";
import { useState } from "react";
import {
  TOUR_TEMPLATES,
  getTemplateData,
  getTemplateLabel,
  type TemplateLanguage,
} from "../../Templates/tourTemplates";
import ImageSelector from "./ImageSelector";
import VisibilityToggle from "./VisibilityToggle";
import type { TourFormData } from "../../types/type";

interface AddTourFormProps {
  onAdd: (tour: TourFormData) => Promise<void>;
  onTemplateSelect: (data: Partial<TourFormData>) => void;
}

export default function AddTourForm({
  onAdd,
  onTemplateSelect,
}: AddTourFormProps) {
  const [templateLanguage, setTemplateLanguage] =
    useState<TemplateLanguage>("en");

  const [newTour, setNewTour] = useState<TourFormData>({
    title: "",
    country: "",
    genre: "",
    hotel: "",
    country_temperature: "",
    duration_day: "",
    duration_night: "",
    group_size: "",
    airlines: "",
    is_featured: false,
    departure_date: "",
    seats: "",
    base_price: "",
    hotels: "",
    services: "",
    description: "",
    image_key: "",
    show_to_user: true,
    show_in_provider: true,
  });

  const applyTemplate = (data: Partial<TourFormData>) => {
    setNewTour((prev) => ({
      ...prev,
      ...data,
      departure_date: "",
      base_price: "",
      show_to_user: true,
      show_in_provider: true,
    }));
    onTemplateSelect(data);
  };

  const handleSubmit = async () => {
    await onAdd(newTour);
    setNewTour({
      title: "",
      country: "",
      genre: "",
      hotel: "",
      country_temperature: "",
      duration_day: "",
      duration_night: "",
      group_size: "",
      airlines: "",
      is_featured: false,
      departure_date: "",
      seats: "",
      base_price: "",
      hotels: "",
      services: "",
      description: "",
      image_key: "",
      show_to_user: true,
      show_in_provider: true,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
        <Plus className="w-5 h-5 mr-2" /> Add Tour (Global-Travel Format)
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {templateLanguage === "mn"
          ? "Зөвлөгөө: Эхлээд template сонго. Тогтмол талбарууд автоматаар бөглөгдөх ба зөвхөн явах огноо, суурь үнэ оруулахад хангалттай."
          : "Tip: choose a template first. It fills fixed fields automatically, then you only set departure date and base price."}
      </p>

      <div className="mb-5 rounded-xl border border-gray-200 p-4 bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
            {templateLanguage === "mn"
              ? `Аяллын Template (${TOUR_TEMPLATES.length})`
              : `Tour Templates (${TOUR_TEMPLATES.length})`}
          </p>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden self-start">
            <button
              type="button"
              onClick={() => setTemplateLanguage("en")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                templateLanguage === "en"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setTemplateLanguage("mn")}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                templateLanguage === "mn"
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              Монгол
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TOUR_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() =>
                applyTemplate(getTemplateData(template, templateLanguage))
              }
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${template.toneClass}`}
            >
              {getTemplateLabel(template, templateLanguage)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <input
          type="text"
          placeholder="Title *"
          value={newTour.title}
          onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Country *"
          value={newTour.country}
          onChange={(e) => setNewTour({ ...newTour, country: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Genre"
          value={newTour.genre}
          onChange={(e) => setNewTour({ ...newTour, genre: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Main Hotel"
          value={newTour.hotel}
          onChange={(e) => setNewTour({ ...newTour, hotel: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="text"
          placeholder="Duration Day"
          value={newTour.duration_day}
          onChange={(e) =>
            setNewTour({ ...newTour, duration_day: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Duration Night"
          value={newTour.duration_night}
          onChange={(e) =>
            setNewTour({ ...newTour, duration_night: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Group Size"
          value={newTour.group_size}
          onChange={(e) => setNewTour({ ...newTour, group_size: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Country Temperature"
          value={newTour.country_temperature}
          onChange={(e) =>
            setNewTour({ ...newTour, country_temperature: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="date"
          value={newTour.departure_date}
          onChange={(e) =>
            setNewTour({ ...newTour, departure_date: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          placeholder="Seats"
          value={newTour.seats}
          onChange={(e) => setNewTour({ ...newTour, seats: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Base Price"
          value={newTour.base_price}
          onChange={(e) =>
            setNewTour({ ...newTour, base_price: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Airlines (comma-separated)"
          value={newTour.airlines}
          onChange={(e) =>
            setNewTour({ ...newTour, airlines: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Hotels (comma-separated)"
          value={newTour.hotels}
          onChange={(e) => setNewTour({ ...newTour, hotels: e.target.value })}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Services (comma-separated)"
          value={newTour.services}
          onChange={(e) =>
            setNewTour({ ...newTour, services: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <textarea
          placeholder="Description"
          value={newTour.description}
          onChange={(e) =>
            setNewTour({ ...newTour, description: e.target.value })
          }
          className="md:col-span-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          rows={3}
        />

        <ImageSelector
          value={newTour.image_key ?? ""}
          onChange={(key) => setNewTour({ ...newTour, image_key: key })}
        />

        <VisibilityToggle
          showToUser={newTour.show_to_user ?? true}
          showInProvider={newTour.show_in_provider ?? true}
          onUserChange={(v) => setNewTour({ ...newTour, show_to_user: v })}
          onProviderChange={(v) =>
            setNewTour({ ...newTour, show_in_provider: v })
          }
        />

        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={Boolean(newTour.is_featured)}
            onChange={(e) =>
              setNewTour({ ...newTour, is_featured: e.target.checked })
            }
          />
          Mark as featured (same as Global-Travel)
        </label>
      </div>

      <div className="flex justify-end mt-4 gap-2">
        <button
          onClick={handleSubmit}
          disabled={!newTour.title || !newTour.country || !newTour.departure_date}
          className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 flex items-center transition"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Tour
        </button>
      </div>
    </div>
  );
}
