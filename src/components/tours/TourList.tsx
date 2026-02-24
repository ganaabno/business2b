// src/components/tours/TourList.tsx
import { MapPin } from "lucide-react";
import TourCard from "./TourCard";
import type { Tour, TourFormData } from "../../types/type";

interface TourListProps {
  tours: Tour[];
  editingId: string | null;
  editForm: TourFormData;
  setEditForm: React.Dispatch<React.SetStateAction<TourFormData>>;
  onStartEdit: (tour: Tour) => void;
  onSaveEdit: () => Promise<void>;
  onCancelEdit: () => void;
  onDelete: (id: string) => Promise<void>;
  showDeleteConfirm: string | null;
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<string | null>>;
  onRefresh: () => Promise<void>;
  onStatusChange: (
    id: string,
    status: "active" | "inactive" | "full" | "completed"
  ) => Promise<void>;
}

export default function TourList({
  tours,
  editingId,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onRefresh,
  onStatusChange,
}: TourListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tours.map((tour) => (
        <TourCard
          key={tour.id}
          tour={tour}
          isEditing={editingId === tour.id}
          editForm={editForm}
          setEditForm={setEditForm}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          onEdit={() => onStartEdit(tour)}
          onDelete={() => onDelete(tour.id)}
          onDeleteConfirm={() => setShowDeleteConfirm(tour.id)}
          onDeleteCancel={() => setShowDeleteConfirm(null)}
          showDeleteConfirm={showDeleteConfirm === tour.id}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}
