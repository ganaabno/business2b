// src/AddTourTab.tsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  isGlobalApiEnabled,
  useGlobalToursPrimary,
} from "../api/globalTravel";
import { pushGlobalTour, syncGlobalPriceRow, syncGlobalTours } from "../api/b2b";
import { ToastContainer } from "react-toastify";
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

const parseCommaValues = (value?: string) =>
  String(value || "")
    .split(/[\n,]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const toNullableText = (value?: string) => {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
};

const isMissingColumnError = (error: any) => {
  const message = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error?.code === "42703" ||
    /column .* does not exist|missing required column|schema cache/i.test(
      message,
    )
  );
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

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
  const [importingGlobalTours, setImportingGlobalTours] = useState(false);
  const hasAutoImportedRef = useRef(false);
  const visibleGlobalCards = tours.filter(
    (tour) =>
      tour.source_tag === "global" || tour.source_tag === "global+local",
  ).length;

  const handleTemplateSelect = (templateData: Partial<TourFormData>) => {
    setEditForm((prev) => ({
      ...prev,
      ...templateData,
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
      image_key: "",
      show_to_user: true,
      show_in_provider: true,
    }));
    showNotification("success", "Template loaded!");
  };

  const handleImportGlobalTours = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (importingGlobalTours) return;

    if (!isGlobalApiEnabled || !useGlobalToursPrimary) {
      if (!silent) {
        showNotification(
          "error",
          "Global tours mode is disabled. Enable VITE_GLOBAL_API_ENABLED=true and VITE_USE_GLOBAL_TOURS_PRIMARY=true.",
        );
      }
      return;
    }

    setImportingGlobalTours(true);
    try {
      const { data: syncResult } = await syncGlobalTours({
        dryRun: false,
        sourceSystem: "global-travel",
      });

      await refreshTours();

      if (syncResult.fetched === 0) {
        if (!silent) {
          showNotification(
            "error",
            "Global API returned 0 tours. Check Global API data or endpoint path.",
          );
        }
        return;
      }

      if (!silent) {
        showNotification(
          "success",
          `Global sync complete: ${syncResult.inserted} inserted, ${syncResult.updated} updated, ${syncResult.linked} linked, ${syncResult.skipped} skipped.`,
        );
      }
    } catch (error) {
      if (!silent) {
        showNotification(
          "error",
          getErrorMessage(error, "Failed to import tours from Global-Travel"),
        );
      }
    } finally {
      setImportingGlobalTours(false);
    }
  };

  useEffect(() => {
    if (hasAutoImportedRef.current) {
      return;
    }

    if (!isGlobalApiEnabled || !useGlobalToursPrimary) {
      return;
    }

    hasAutoImportedRef.current = true;
    void handleImportGlobalTours({ silent: true });
  }, []);

  const handleAddTour = async (newTour: TourFormData) => {
    if (
      !newTour.title?.trim() ||
      !newTour.country?.trim() ||
      !newTour.departure_date
    ) {
      showNotification("error", "Title, country, and date are required");
      return;
    }

    const seats = parseInt(newTour.seats || "0", 10) || 0;
    const price = parseFloat(newTour.base_price || "0") || 0;
    const imageKey = newTour.image_key?.trim() || "";
    const airlines = parseCommaValues(newTour.airlines);

    const legacyPayload = {
      title: newTour.title.trim(),
      description: newTour.description?.trim() || null,
      departuredate: newTour.departure_date,
      dates: [newTour.departure_date],
      seats,
      available_seats: seats,
      hotels: parseCommaValues(newTour.hotels),
      services: parseCommaValues(newTour.services).map((name) => ({
        name,
        price: 0,
      })),
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: "active" as const,
      creator_name: currentUser.username || currentUser.email || currentUser.id,
      base_price: price,
      image_key: imageKey,
      show_to_user: newTour.show_to_user,
      show_in_provider: newTour.show_in_provider,
      name: newTour.title.trim(),
    };

    const globalProfilePayload = {
      ...legacyPayload,
      cover_photo: imageKey || null,
      country: toNullableText(newTour.country),
      hotel: toNullableText(newTour.hotel),
      country_temperature: toNullableText(newTour.country_temperature),
      duration_day: toNullableText(newTour.duration_day),
      duration_night: toNullableText(newTour.duration_night),
      group_size: toNullableText(newTour.group_size),
      is_featured: Boolean(newTour.is_featured),
      genre: toNullableText(newTour.genre),
      airlines,
    };

    try {
      let usedLegacySchema = false;

      let { data, error } = await supabase
        .from("tours")
        .insert([globalProfilePayload])
        .select()
        .single();

      if (error && isMissingColumnError(error)) {
        usedLegacySchema = true;
        const fallbackResult = await supabase
          .from("tours")
          .insert([legacyPayload])
          .select()
          .single();
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;

      const insertedTour = {
        ...data,
        id: String(data.id),
        departure_date:
          data.departuredate || data.departure_date || newTour.departure_date,
        image_key: imageKey || data.image_key || data.cover_photo || "",
        cover_photo: data.cover_photo || imageKey || null,
        country: data.country || toNullableText(newTour.country),
        hotel: data.hotel || toNullableText(newTour.hotel),
        country_temperature:
          data.country_temperature ||
          toNullableText(newTour.country_temperature),
        duration_day: data.duration_day || toNullableText(newTour.duration_day),
        duration_night:
          data.duration_night || toNullableText(newTour.duration_night),
        group_size: data.group_size || toNullableText(newTour.group_size),
        is_featured:
          typeof data.is_featured === "boolean"
            ? data.is_featured
            : Boolean(newTour.is_featured),
        genre: data.genre || toNullableText(newTour.genre),
        airlines: Array.isArray(data.airlines) ? data.airlines : airlines,
      } as Tour;

      setTours((prev) => [...prev, insertedTour]);

      let globalPushWarning: string | null = null;
      let pushedToGlobal = false;

      try {
        const pushResponse = await pushGlobalTour({
          action: "create",
          localTourId: insertedTour.id,
          remoteTourId: insertedTour.source_tour_id || undefined,
          tour: insertedTour as unknown as Record<string, unknown>,
        });

        pushedToGlobal =
          pushResponse.data.remoteAction === "created" ||
          pushResponse.data.remoteAction === "updated";
        globalPushWarning = pushResponse.data.warning || null;
      } catch (pushError) {
        globalPushWarning = getErrorMessage(
          pushError,
          "Global tour push failed after local create.",
        );
      }

      showNotification(
        "success",
        !globalPushWarning && pushedToGlobal
          ? "Tour added locally and pushed to Global."
          : usedLegacySchema
            ? "Tour added with legacy schema. Import Global tours to keep both sides aligned."
            : "Tour added locally.",
      );

      if (globalPushWarning) {
        showNotification("error", globalPushWarning);
      }

      await refreshTours();
    } catch (e: any) {
      showNotification("error", e.message);
    }
  };

  type Status = "active" | "inactive" | "full" | "completed";

  const startEdit = (tour: Tour) => {
    setEditingId(tour.id);
    setEditForm({
      title: tour.title,
      country: tour.country || "",
      genre: tour.genre || "",
      hotel: tour.hotel || "",
      country_temperature: tour.country_temperature || "",
      duration_day:
        tour.duration_day !== null && tour.duration_day !== undefined
          ? String(tour.duration_day)
          : "",
      duration_night:
        tour.duration_night !== null && tour.duration_night !== undefined
          ? String(tour.duration_night)
          : "",
      group_size:
        tour.group_size !== null && tour.group_size !== undefined
          ? String(tour.group_size)
          : "",
      airlines: Array.isArray(tour.airlines) ? tour.airlines.join(", ") : "",
      is_featured: Boolean(tour.is_featured),
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
        tour.status as any,
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
    const imageKey = editForm.image_key?.trim() || "";
    const airlines = parseCommaValues(editForm.airlines);

    const legacyUpdatePayload = {
      title: editForm.title.trim(),
      description: editForm.description?.trim() || null,
      departuredate: editForm.departure_date,
      dates: editForm.departure_date ? [editForm.departure_date] : [],
      seats,
      available_seats: Math.min(seats, curAvail),
      hotels: parseCommaValues(editForm.hotels),
      services: parseCommaValues(editForm.services).map((name) => ({
        name,
        price: 0,
      })),
      base_price: price,
      image_key: imageKey,
      show_to_user: editForm.show_to_user,
      show_in_provider: editForm.show_in_provider,
      status: editForm.status,
      updated_at: new Date().toISOString(),
      name: editForm.title.trim(),
    };

    const globalProfileUpdatePayload = {
      ...legacyUpdatePayload,
      cover_photo: imageKey || null,
      country: toNullableText(editForm.country),
      hotel: toNullableText(editForm.hotel),
      country_temperature: toNullableText(editForm.country_temperature),
      duration_day: toNullableText(editForm.duration_day),
      duration_night: toNullableText(editForm.duration_night),
      group_size: toNullableText(editForm.group_size),
      is_featured: Boolean(editForm.is_featured),
      genre: toNullableText(editForm.genre),
      airlines,
    };

    const localUpdatedTour: Tour = {
      ...originalTour,
      ...globalProfileUpdatePayload,
      departure_date: globalProfileUpdatePayload.departuredate || undefined,
      image_key: globalProfileUpdatePayload.image_key,
      cover_photo:
        globalProfileUpdatePayload.cover_photo ||
        globalProfileUpdatePayload.image_key ||
        null,
      hotels: globalProfileUpdatePayload.hotels ?? originalTour.hotels ?? null,
      services:
        globalProfileUpdatePayload.services ?? originalTour.services ?? null,
      country: globalProfileUpdatePayload.country,
      hotel: globalProfileUpdatePayload.hotel,
      country_temperature: globalProfileUpdatePayload.country_temperature,
      duration_day: globalProfileUpdatePayload.duration_day,
      duration_night: globalProfileUpdatePayload.duration_night,
      group_size: globalProfileUpdatePayload.group_size,
      is_featured: globalProfileUpdatePayload.is_featured,
      genre: globalProfileUpdatePayload.genre,
      airlines,
    };

    const backupTours = [...tours];
    setTours((prev) =>
      prev.map((t) => (t.id === editingId ? localUpdatedTour : t)),
    );
    setEditingId(null);

    try {
      let usedLegacySchema = false;

      let { error } = await supabase
        .from("tours")
        .update(globalProfileUpdatePayload)
        .eq("id", editingId);

      if (error && isMissingColumnError(error)) {
        usedLegacySchema = true;
        const fallbackResult = await supabase
          .from("tours")
          .update(legacyUpdatePayload)
          .eq("id", editingId);
        error = fallbackResult.error;
      }

      if (error) throw error;

      let globalPushWarning: string | null = null;
      let pushedToGlobal = false;

      try {
        const pushResponse = await pushGlobalTour({
          action: "update",
          localTourId: editingId,
          remoteTourId: originalTour.source_tour_id || undefined,
          tour: {
            ...localUpdatedTour,
            source_tour_id: originalTour.source_tour_id || null,
            source_system: originalTour.source_system || null,
          } as Record<string, unknown>,
        });

        pushedToGlobal =
          pushResponse.data.remoteAction === "updated" ||
          pushResponse.data.remoteAction === "created";
        globalPushWarning = pushResponse.data.warning || null;
      } catch (pushError) {
        globalPushWarning = getErrorMessage(
          pushError,
          "Global tour push failed after local update.",
        );
      }

      const normalizedDepartureDate = String(
        globalProfileUpdatePayload.departuredate || "",
      )
        .trim()
        .slice(0, 10);
      const normalizedOriginalDepartureDate = String(
        originalTour.departure_date || "",
      )
        .trim()
        .slice(0, 10);
      const remoteTourId = String(originalTour.source_tour_id || "").trim();
      const seatsChanged =
        seats !== Math.max(0, Math.floor(Number(originalTour.seats) || 0));
      const departureChanged =
        normalizedDepartureDate !== normalizedOriginalDepartureDate;
      const shouldSyncGlobalSeats =
        (originalTour.source_tag === "global" ||
          originalTour.source_tag === "global+local" ||
          originalTour.source_system === "global-travel") &&
        /^\d{4}-\d{2}-\d{2}$/.test(normalizedDepartureDate) &&
        (seatsChanged || departureChanged) &&
        (Boolean(remoteTourId) || Boolean(editingId));

      let globalSeatSyncWarning: string | null = null;

      if (shouldSyncGlobalSeats) {
        try {
          await syncGlobalPriceRow({
            localTourId: editingId,
            remoteTourId: remoteTourId || undefined,
            departureDate: normalizedDepartureDate,
            seats,
          });
        } catch (syncError) {
          globalSeatSyncWarning = getErrorMessage(
            syncError,
            "Global seat sync failed after local update.",
          );
        }
      }

      showNotification(
        "success",
        pushedToGlobal && !globalPushWarning && !globalSeatSyncWarning
          ? "Tour updated locally and pushed to Global."
          : shouldSyncGlobalSeats && !globalSeatSyncWarning
            ? "Tour updated locally and synced to Global seats."
            : usedLegacySchema
              ? "Tour updated with legacy schema. Import Global tours to keep both sides aligned."
              : "Tour updated locally.",
      );

      if (globalPushWarning) {
        showNotification("error", globalPushWarning);
      }

      if (globalSeatSyncWarning) {
        showNotification("error", globalSeatSyncWarning);
      }

      await refreshTours();
    } catch (e: any) {
      showNotification("error", `Failed to update: ${e.message}`);
      setTours(backupTours);
    }
  };

  const handleDeleteTour = async (id: string) => {
    const backup = [...tours];
    const deletingTour = tours.find((tour) => tour.id === id) || null;
    setTours(tours.filter((t) => t.id !== id));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", id);
      if (error) throw error;

      let globalPushWarning: string | null = null;
      let pushedToGlobal = false;

      try {
        const pushResponse = await pushGlobalTour({
          action: "delete",
          localTourId: id,
          remoteTourId: deletingTour?.source_tour_id || undefined,
        });

        pushedToGlobal = pushResponse.data.remoteAction === "deleted";
        globalPushWarning = pushResponse.data.warning || null;
      } catch (pushError) {
        globalPushWarning = getErrorMessage(
          pushError,
          "Global tour delete push failed after local delete.",
        );
      }

      showNotification(
        "success",
        pushedToGlobal && !globalPushWarning
          ? "Tour deleted locally and removed from Global."
          : "Tour deleted locally.",
      );

      if (globalPushWarning) {
        showNotification("error", globalPushWarning);
      }

      await refreshTours();
    } catch (e: any) {
      showNotification("error", e.message);
      setTours(backup);
    } finally {
      setShowDeleteConfirm(null);
    }
  };

  const handleStatusChange = async (
    id: string,
    status: "active" | "inactive" | "full" | "completed",
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

      let globalPushWarning: string | null = null;
      let pushedToGlobal = false;

      try {
        const pushResponse = await pushGlobalTour({
          action: "update",
          localTourId: id,
          remoteTourId: tour.source_tour_id || undefined,
          tour: {
            ...tour,
            status,
            updated_at: new Date().toISOString(),
          } as unknown as Record<string, unknown>,
        });

        pushedToGlobal =
          pushResponse.data.remoteAction === "updated" ||
          pushResponse.data.remoteAction === "created";
        globalPushWarning = pushResponse.data.warning || null;
      } catch (pushError) {
        globalPushWarning = getErrorMessage(
          pushError,
          "Global tour push failed after status update.",
        );
      }

      showNotification(
        "success",
        pushedToGlobal && !globalPushWarning
          ? `Tour is now ${status} and synced to Global!`
          : `Tour is now ${status}!`,
      );

      if (globalPushWarning) {
        showNotification("error", globalPushWarning);
      }

      await refreshTours();
    } catch (e: any) {
      showNotification("error", e.message);
      setTours(backup);
    }
  };

  return (
    <>
      <ToastContainer limit={3} position="top-right" autoClose={3000} />
      <div className="max-w-[105rem] mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        <AddTourForm
          onAdd={handleAddTour}
          onTemplateSelect={handleTemplateSelect}
        />

        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-800">
                Global-Travel Import
              </p>
              <p className="text-xs text-slate-500">
                {visibleGlobalCards} global tours of {tours.length} total
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleImportGlobalTours();
              }}
              disabled={importingGlobalTours}
              className="inline-flex items-center justify-center rounded bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importingGlobalTours
                ? "..."
                : "Import Global"}
            </button>
          </div>
        </div>

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
