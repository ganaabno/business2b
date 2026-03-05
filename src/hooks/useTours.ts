// hooks/useTours.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
import type { Tour } from "../types/type";
import {
  fetchToursFromGlobalApi,
  isGlobalApiEnabled,
  mergeGlobalToursWithLocal,
  useGlobalToursFallbackLocal,
  useGlobalToursPrimary,
} from "../api/globalTravel";

interface UseToursProps {
  userRole: string;
  tours?: Tour[];
  setTours?: React.Dispatch<React.SetStateAction<Tour[]>>;
}

export function useTours({
  userRole,
  tours: externalTours,
  setTours: setExternalTours,
}: UseToursProps) {
  const [internalTours, setInternalTours] = useState<Tour[]>([]);
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "hidden">("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const lastFetchAtRef = useRef(0);
  const isFetchingRef = useRef(false);

  const tours = externalTours ?? internalTours;
  const setTours = setExternalTours ?? setInternalTours;

  const fetchTours = useCallback(async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = opts?.force ?? false;
    const silent = opts?.silent ?? true;
    const now = Date.now();

    if (!force && now - lastFetchAtRef.current < 10000) {
      return;
    }
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    if (!silent) {
      setLoading(true);
    }
    try {
      const baseSelectModern = `
        id, title, seats, departure_date, status, show_in_provider,
        description, creator_name, tour_number, name, dates,
        hotels, services, created_by, created_at, updated_at,
        base_price, available_seats,
        show_to_user,
        image_key
      `;

      const baseSelectLegacy = `
        id, title, seats, departuredate, status, show_in_provider,
        description, creator_name, tour_number, name, dates,
        hotels, services, created_by, created_at, updated_at,
        base_price, available_seats,
        show_to_user,
        image_key
      `;

      const sourceIdentitySelectModern = `${baseSelectModern}, source_system, source_tour_id`;
      const sourceIdentitySelectLegacy = `${baseSelectLegacy}, source_system, source_tour_id`;

      const extendedSelectModern = `${sourceIdentitySelectModern},
        country, hotel, country_temperature, duration_day, duration_night,
        group_size, is_featured, genre, airlines, cover_photo`;

      const extendedSelectLegacy = `${sourceIdentitySelectLegacy},
        country, hotel, country_temperature, duration_day, duration_night,
        group_size, is_featured, genre, airlines, cover_photo`;

      const runToursQuery = (selectColumns: string) => {
        let query = supabase.from("tours").select(selectColumns);

        if (userRole !== "admin" && userRole !== "superadmin") {
          query = query
            .in("status", ["active", "pending"])
            .eq("show_in_provider", true);
        }

        return query;
      };

      const shouldUseExtendedColumns = ["admin", "superadmin"].includes(userRole);

      const selectCandidates = shouldUseExtendedColumns
        ? [
            extendedSelectModern,
            extendedSelectLegacy,
            sourceIdentitySelectModern,
            sourceIdentitySelectLegacy,
            baseSelectModern,
            baseSelectLegacy,
          ]
        : [baseSelectModern, baseSelectLegacy];

      let toursData: any[] | null = null;
      let toursError: any = null;

      for (const selectColumns of selectCandidates) {
        const result = await runToursQuery(selectColumns);
        if (!result.error) {
          toursData = result.data || [];
          toursError = null;
          break;
        }
        toursError = result.error;
      }

      if (toursError) throw toursError;

      const { data: ordersData } = await supabase
        .from("orders")
        .select("id, travel_choice, departureDate, passenger");

      const { data: confirmationsData } = await supabase
        .from("booking_confirmations")
        .select(
          "order_id, bus_number, guide_name, weather_emergency, updated_by, updated_at"
        );

      const ordersWithConfirmations = (ordersData ?? []).map((order) => ({
        ...order,
        booking_confirmation:
          (confirmationsData ?? []).find((c) => c.order_id === order.id) ||
          null,
      }));

      const normalizedTours: Tour[] = (toursData ?? []).map((tour: any) => {
        const matchingOrder = ordersWithConfirmations.find(
          (o) =>
            o.travel_choice?.toLowerCase() === tour.title?.toLowerCase() &&
            o.departureDate ===
              (typeof tour.departure_date === "string"
                ? tour.departure_date
                : tour.departuredate)
        );

        const rawDates = tour.dates;
        const depDate =
          (typeof tour.departure_date === "string" && tour.departure_date) ||
          (typeof tour.departuredate === "string" && tour.departuredate) ||
          "";

        const validDates: string[] = [];

        if (Array.isArray(rawDates)) {
          validDates.push(
            ...rawDates
              .filter((d: any) => d && typeof d === "string")
              .map(String)
          );
        } else if (typeof rawDates === "string" && rawDates.trim()) {
          validDates.push(rawDates.trim());
        }

        if (
          validDates.length === 0 &&
          depDate &&
          typeof depDate === "string" &&
          depDate.trim()
        ) {
          validDates.push(depDate.trim());
        }

        const firstDate = validDates.length > 0 ? validDates[0] : undefined;

        const parsedAirlines = Array.isArray(tour.airlines)
          ? tour.airlines
              .map((airline: any) => String(airline || "").trim())
              .filter((airline: string) => airline.length > 0)
          : typeof tour.airlines === "string"
            ? tour.airlines
                .split(/[\n,]/g)
                .map((airline: string) => airline.trim())
                .filter((airline: string) => airline.length > 0)
            : [];

        return {
          source_tag: "local",
          source_system:
            typeof tour.source_system === "string" ? tour.source_system : null,
          source_tour_id:
            typeof tour.source_tour_id === "string" ? tour.source_tour_id : null,
          country: typeof tour.country === "string" ? tour.country : null,
          hotel: typeof tour.hotel === "string" ? tour.hotel : null,
          country_temperature:
            typeof tour.country_temperature === "string"
              ? tour.country_temperature
              : null,
          duration_day:
            typeof tour.duration_day === "string" ? tour.duration_day : null,
          duration_night:
            typeof tour.duration_night === "string"
              ? tour.duration_night
              : null,
          group_size:
            tour.group_size !== null && tour.group_size !== undefined
              ? String(tour.group_size)
              : null,
          is_featured: Boolean(tour.is_featured),
          genre: typeof tour.genre === "string" ? tour.genre : null,
          airlines: parsedAirlines,
          cover_photo:
            typeof tour.cover_photo === "string" ? tour.cover_photo : null,
          id: String(tour.id),
          title: tour.title?.trim() || "Unnamed Tour",
          name: tour.name?.trim() || tour.title?.trim() || "Unnamed Tour",
          seats: Number(tour.seats) || 0,
          available_seats:
            Number(tour.available_seats) || Number(tour.seats) || 0,
          departure_date: firstDate,
          dates: validDates,
          status: tour.status || "active",
          show_in_provider: tour.show_in_provider ?? true,
          show_to_user: tour.show_to_user ?? true,
          description: tour.description || "",
          creator_name: tour.creator_name || "",
          tour_number: tour.tour_number || null,
          hotels: Array.isArray(tour.hotels) ? tour.hotels.filter(Boolean) : [],
          services: Array.isArray(tour.services) ? tour.services : [],
          created_by: tour.created_by || "",
          created_at: tour.created_at || "",
          updated_at: tour.updated_at || "",
          base_price: tour.base_price ?? 0,
          image_key: tour.image_key ?? "",
          booking_confirmation: matchingOrder?.booking_confirmation
            ? {
                order_id: matchingOrder.booking_confirmation.order_id,
                bus_number: matchingOrder.booking_confirmation.bus_number,
                guide_name: matchingOrder.booking_confirmation.guide_name,
                weather_emergency:
                  matchingOrder.booking_confirmation.weather_emergency,
                updated_by: matchingOrder.booking_confirmation.updated_by,
                updated_at: matchingOrder.booking_confirmation.updated_at,
                passenger_count: matchingOrder.passenger,
                updated_by_email: matchingOrder.booking_confirmation.updated_by,
              }
            : null,
        };
      });

      const shouldUseGlobalPrimary =
        isGlobalApiEnabled &&
        useGlobalToursPrimary &&
        ["manager", "provider", "user"].includes(userRole);

      if (shouldUseGlobalPrimary) {
        try {
          const globalTours = await fetchToursFromGlobalApi();
          const mergedTours = mergeGlobalToursWithLocal(globalTours, normalizedTours);
          setTours(mergedTours);
          return;
        } catch (globalError) {
          console.warn("Global tours fetch failed, fallback to local tours", globalError);
        }
      }

      setTours(normalizedTours);
      lastFetchAtRef.current = Date.now();
    } catch (error: any) {
      console.error("Fetch error:", error);
      if (!silent) {
        toast.error("Failed to load tours.");
      }
    } finally {
      isFetchingRef.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, [userRole, setTours]);

  useEffect(() => {
    if (tours.length > 0) {
      setLoading(false);
    }
  }, [tours.length]);

  useEffect(() => {
    if (tours.length === 0) {
      fetchTours({ force: true, silent: false });
    }

    const subs = [
      supabase
        .channel("tours")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tours" },
          () => fetchTours({ silent: true })
        ),
      supabase
        .channel("orders")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          () => fetchTours({ silent: true })
        ),
      supabase
        .channel("confirmations")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "booking_confirmations" },
          () => fetchTours({ silent: true })
        ),
    ].map((s) => s.subscribe());

    return () => subs.forEach((s) => supabase.removeChannel(s));
  }, [fetchTours]);

  const filteredTours = tours.filter((tour) => {
    const matchesTitle = tour.title
      .toLowerCase()
      .includes(titleFilter.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || tour.status === statusFilter;
    const matchesView =
      viewFilter === "all" ||
      (viewFilter === "hidden" && !tour.show_in_provider);
    const tourDate = tour.departure_date ? new Date(tour.departure_date) : null;
    const start = dateFilterStart ? new Date(dateFilterStart) : null;
    const end = dateFilterEnd ? new Date(dateFilterEnd) : null;
    const matchesDate =
      (!start || (tourDate && tourDate >= start)) &&
      (!end || (tourDate && tourDate <= end));
    return matchesTitle && matchesStatus && matchesDate && matchesView;
  });

  const handleTourChange = async (
    tourId: string,
    field: keyof Tour,
    value: any
  ) => {
    const prev = [...tours];
    const updated = tours.map((t) =>
      t.id === tourId
        ? {
            ...t,
            [field]: value,
            ...(field === "departure_date" && {
              dates: value
                ? [value]
                : Array.isArray(t.dates) && t.dates.length > 0
                ? t.dates
                : [],
              departure_date: value,
            }),
          }
        : t
    );
    setTours(updated);

    try {
      let updateError: any = null;

      if (field === "departure_date") {
        const modernResult = await supabase
          .from("tours")
          .update({ departure_date: value, updated_at: new Date().toISOString() })
          .eq("id", tourId);

        updateError = modernResult.error;

        if (updateError) {
          const legacyResult = await supabase
            .from("tours")
            .update({ departuredate: value, updated_at: new Date().toISOString() })
            .eq("id", tourId);
          updateError = legacyResult.error;
        }
      } else {
        const { error } = await supabase
          .from("tours")
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq("id", tourId);
        updateError = error;
      }

      const error = updateError;
      if (error) throw error;
      toast.success("Updated!");
      fetchTours({ force: true, silent: true });
    } catch (error: any) {
      toast.error(error.message);
      setTours(prev);
    }
  };

  const handleDeleteTour = async (tourId: string) => {
    const prev = [...tours];
    setTours(tours.filter((t) => t.id !== tourId));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", tourId);
      if (error) throw error;
      toast.success("Deleted!");
      fetchTours({ force: true, silent: true });
    } catch (error: any) {
      toast.error(error.message);
      setTours(prev);
    }
    setShowDeleteConfirm(null);
  };

  const formatDisplayDate = (date: string) => {
    if (!date) return "Not set";
    const d = new Date(date);
    return isNaN(d.getTime())
      ? "Invalid"
      : d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
  };

  const refreshTours = useCallback(() => {
    return fetchTours({ force: true, silent: false });
  }, [fetchTours]);

  return {
    tours,
    filteredTours,
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    dateFilterStart,
    setDateFilterStart,
    dateFilterEnd,
    setDateFilterEnd,
    viewFilter,
    setViewFilter,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleTourChange,
    handleDeleteTour,
    formatDisplayDate,
    refreshTours,
    loading,
  };
}
