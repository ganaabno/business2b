// src/AddTourTab.tsx
import { useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AddTourForm from "../components/tours/AddTourForm";
import TourTabs from "../components/tours/TourTabs";
import { useTours } from "../hooks/useTours";
import { useAuth } from "../context/AuthProvider";
import type { Tour, User as UserType, TourFormData } from "../types/type";

interface AddTourTabProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: UserType;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function AddTourTab({
  tours,
  setTours,
  currentUser,
  showNotification,
}: AddTourTabProps) {
  const { currentUser: authUser } = useAuth();
  const userRole = authUser?.role || "user";

  const { refreshTours, showDeleteConfirm, setShowDeleteConfirm } = useTours({
    userRole,
    tours,
    setTours,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TourFormData>({});

  const handleTemplateSelect = (templateData: Partial<TourFormData>) => {
    setEditForm((prev) => ({
      ...prev,
      ...templateData,
      departure_date: "",
      seats: "",
      base_price: "",
      image_key: "",
      show_to_user: true,
      show_in_provider: true,
    }));
    showNotification("success", "Template loaded!");
  };

  const handleAddTour = async (newTour: TourFormData) => {
    if (!newTour.title?.trim() || !newTour.departure_date) {
      showNotification("error", "Title and date are required");
      return;
    }

    const seats = parseInt(newTour.seats || "0", 10) || 0;
    const price = parseFloat(newTour.base_price || "0") || 0;
    const imageKey = newTour.image_key?.trim() || "";

    const payload = {
      title: newTour.title.trim(),
      description: newTour.description?.trim() || null,
      departuredate: newTour.departure_date,
      seats,
      available_seats: seats,
      hotels: newTour.hotels
        ?.trim()
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean),
      services: newTour.services
        ?.trim()
        .split(",")
        .map((s) => ({ name: s.trim(), price: 0 }))
        .filter((s) => s.name),
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active" as const,
      creator_name: currentUser.username || currentUser.email || currentUser.id,
      base_price: price,
      image_key: imageKey,
      show_to_user: newTour.show_to_user,
      show_in_provider: newTour.show_in_provider,
    };

    try {
      const { data, error } = await supabase
        .from("tours")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;

      setTours((prev) => [
        ...prev,
        {
          ...data,
          id: String(data.id),
          departure_date: data.departuredate,
          image_key: imageKey || data.image_key || "",
        } as Tour,
      ]);

      showNotification("success", "Tour added!");
    } catch (e: any) {
      showNotification("error", e.message);
    }
  };

  type Status = "active" | "inactive" | "full" | "completed";

  const startEdit = (tour: Tour) => {
    setEditingId(tour.id);
    setEditForm({
      title: tour.title,
      departure_date: tour.departure_date ?? "",
      seats: tour.seats?.toString() ?? "",
      base_price: tour.base_price?.toString() ?? "",
      hotels: Array.isArray(tour.hotels)
        ? tour.hotels
            .filter((h): h is string => typeof h === "string")
            .join(", ")
        : tour.hotels || "",
      services:
        tour.services
          ?.map((s) => s.name)
          .filter(Boolean)
          .join(", ") || "",
      description: tour.description || "",
      image_key: tour.image_key?.trim() || "",
      show_to_user: tour.show_to_user,
      show_in_provider: tour.show_in_provider ?? false,
      status: ["active", "inactive", "full", "completed"].includes(
        tour.status as any
      )
        ? (tour.status as "active" | "inactive" | "full" | "completed")
        : "inactive",
    });
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.title?.trim()) return;

    const seats = parseInt(editForm.seats || "0", 10) || 0;
    const price = parseFloat(editForm.base_price || "0") || 0;
    const originalTour = tours.find((t) => t.id === editingId);
    if (!originalTour) return;

    const curAvail = originalTour.available_seats || 0;

    const dbUpdatePayload = {
      title: editForm.title.trim(),
      description: editForm.description?.trim() || null,
      departuredate: editForm.departure_date,
      seats,
      available_seats: Math.min(seats, curAvail),
      hotels: editForm.hotels
        ?.trim()
        .split(",")
        .map((h) => h.trim())
        .filter((h) => h),
      services: editForm.services
        ?.trim()
        .split(",")
        .map((s) => ({ name: s.trim(), price: 0 }))
        .filter((s) => s.name),
      base_price: price,
      image_key: editForm.image_key?.trim() || "",
      show_to_user: editForm.show_to_user,
      show_in_provider: editForm.show_in_provider,
      status: editForm.status,
      updated_at: new Date().toISOString(),
    };

    const localUpdatedTour: Tour = {
      ...originalTour,
      ...dbUpdatePayload,
      departure_date: dbUpdatePayload.departuredate,
      image_key: dbUpdatePayload.image_key,
      hotels: dbUpdatePayload.hotels ?? originalTour.hotels ?? null,
      services: dbUpdatePayload.services ?? originalTour.services ?? null,
    };

    const backupTours = [...tours];
    setTours((prev) =>
      prev.map((t) => (t.id === editingId ? localUpdatedTour : t))
    );
    setEditingId(null);

    try {
      const { error } = await supabase
        .from("tours")
        .update(dbUpdatePayload)
        .eq("id", editingId);
      if (error) throw error;
      showNotification("success", "Tour updated!");
    } catch (e: any) {
      showNotification("error", `Failed to update: ${e.message}`);
      setTours(backupTours);
    }
  };

  const handleDeleteTour = async (id: string) => {
    const backup = [...tours];
    setTours(tours.filter((t) => t.id !== id));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", id);
      if (error) throw error;
      showNotification("success", "Tour deleted");
    } catch (e: any) {
      showNotification("error", e.message);
      setTours(backup);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const handleStatusChange = async (
    id: string,
    status: "active" | "inactive" | "full" | "completed"
  ) => {
    const tour = tours.find((t) => t.id === id);
    if (!tour) return;

    const backup = [...tours];
    setTours((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));

    try {
      const { error } = await supabase
        .from("tours")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      showNotification("success", `Tour is now ${status}!`);
    } catch (e: any) {
      showNotification("error", e.message);
      setTours(backup);
    }
  };

  return (
    <>
      <ToastContainer limit={3} position="top-right" autoClose={3000} />
      <div className="max-w-[105rem] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <AddTourForm
          onAdd={handleAddTour}
          onTemplateSelect={handleTemplateSelect}
        />
        <TourTabs
          tours={tours}
          editingId={editingId}
          editForm={editForm}
          setEditForm={setEditForm}
          onStartEdit={startEdit}
          onSaveEdit={saveEdit}
          onCancelEdit={() => setEditingId(null)}
          onDelete={handleDeleteTour}
          showDeleteConfirm={showDeleteConfirm}
          setShowDeleteConfirm={setShowDeleteConfirm}
          onRefresh={refreshTours}
          onStatusChange={handleStatusChange}
        />
      </div>
    </>
  );
}
