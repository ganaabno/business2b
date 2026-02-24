import { Plus } from "lucide-react";
import { useState } from "react";
import SanyaTemplate from "../../Templates/SanyaTemplate";
import ShanghaiTemplate from "../../Templates/ShanghaiTemplate";
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
  const [newTour, setNewTour] = useState<TourFormData>({
    title: "",
    departure_date: "",
    seats: "",
    base_price: "",
    hotels: "",
    services: "",
    description: "",
    image_key: "", // <-- guaranteed string
    show_to_user: true, // <-- guaranteed boolean
    show_in_provider: true,
  });

  const handleSubmit = async () => {
    await onAdd(newTour);
    setNewTour({
      title: "",
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
        <Plus className="w-5 h-5 mr-2" /> Add New Tour
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Title *"
          value={newTour.title}
          onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
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
          placeholder="Price"
          value={newTour.base_price}
          onChange={(e) =>
            setNewTour({ ...newTour, base_price: e.target.value })
          }
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <ImageSelector
          value={newTour.image_key ?? ""} // <-- safe fallback
          onChange={(key) => setNewTour({ ...newTour, image_key: key })}
        />

        <VisibilityToggle
          showToUser={newTour.show_to_user ?? true} // <-- safe fallback
          showInProvider={newTour.show_in_provider ?? true}
          onUserChange={(v) => setNewTour({ ...newTour, show_to_user: v })}
          onProviderChange={(v) =>
            setNewTour({ ...newTour, show_in_provider: v })
          }
        />

        <input
          type="text"
          placeholder="Hotels (comma-separated)"
          value={newTour.hotels}
          onChange={(e) => setNewTour({ ...newTour, hotels: e.target.value })}
          className="md:col-span-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          placeholder="Description"
          value={newTour.description}
          onChange={(e) =>
            setNewTour({ ...newTour, description: e.target.value })
          }
          className="md:col-span-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
          rows={2}
        />
      </div>

      <div className="flex justify-end mt-4 gap-2">
        <button
          onClick={handleSubmit}
          disabled={!newTour.title || !newTour.departure_date}
          className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 flex items-center transition"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Tour
        </button>
        <SanyaTemplate
          onSelect={(data) =>
            setNewTour((prev) => ({
              ...prev,
              ...data,
              departure_date: "",
              seats: "",
              base_price: "",
              image_key: "",
              show_to_user: true,
              show_in_provider: true,
            }))
          }
        />
        <ShanghaiTemplate
          onSelect={(data) =>
            setNewTour((prev) => ({
              ...prev,
              ...data,
              departure_date: "",
              seats: "",
              base_price: "",
              image_key: "",
              show_to_user: true,
              show_in_provider: true,
            }))
          }
        />
      </div>
    </div>
  );
}
