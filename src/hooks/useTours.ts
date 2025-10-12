import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
import type { Tour } from "../types/type";

interface UseToursProps {
  userRole: string;
  tours?: Tour[];
  setTours?: React.Dispatch<React.SetStateAction<Tour[]>>;
}

interface UseToursReturn {
  tours: Tour[];
  filteredTours: Tour[];
  titleFilter: string;
  setTitleFilter: React.Dispatch<React.SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  dateFilterStart: string;
  setDateFilterStart: React.Dispatch<React.SetStateAction<string>>;
  dateFilterEnd: string;
  setDateFilterEnd: React.Dispatch<React.SetStateAction<string>>;
  viewFilter: "all" | "hidden";
  setViewFilter: React.Dispatch<React.SetStateAction<"all" | "hidden">>;
  showDeleteConfirm: string | null;
  setShowDeleteConfirm: React.Dispatch<React.SetStateAction<string | null>>;
  handleTourChange: (
    tourId: string,
    field: keyof Tour,
    value: any
  ) => Promise<void>;
  handleDeleteTour: (tourId: string) => Promise<void>;
  formatDisplayDate: (dateString: string) => string;
  refreshTours: () => Promise<void>;
  loading: boolean;
}

export function useTours({
  userRole,
  tours: externalTours,
  setTours: setExternalTours,
}: UseToursProps): UseToursReturn {
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

  const tours = externalTours ?? internalTours;
  const setTours = setExternalTours ?? setInternalTours;

  const fetchTours = async () => {
    setLoading(true);
    try {
      // Fetch tours
      let toursQuery = supabase.from("tours").select(`
          id,
          title,
          seats,
          departuredate,
          status,
          show_in_provider,
          description,
          creator_name,
          tour_number,
          name,
          dates,
          hotels,
          services,
          created_by,
          created_at,
          updated_at,
          base_price,
          available_seats
        `);

      if (userRole !== "admin" && userRole !== "superadmin") {
        toursQuery = toursQuery
          .eq("status", "active")
          .eq("show_in_provider", true);
      }

      const { data: toursData, error: toursError } = await toursQuery;
      if (toursError) {
        console.error("Error fetching tours:", toursError);
        toast.error(`Failed to fetch tours: ${toursError.message}`);
        return;
      }

      // Fetch orders (with passenger)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, travel_choice, departureDate, created_by, passenger");

      if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        toast.error(`Failed to fetch orders: ${ordersError.message}`);
        // Proceed without orders data
      }

      // Fetch booking confirmations
      const { data: confirmationsData, error: confirmationsError } =
        await supabase
          .from("booking_confirmations")
          .select(
            "order_id, bus_number, guide_name, weather_emergency, updated_by, updated_at"
          );

      if (confirmationsError) {
        console.error(
          "Error fetching booking confirmations:",
          confirmationsError
        );
        toast.error(
          `Failed to fetch booking confirmations: ${confirmationsError.message}`
        );
        // Proceed without confirmations
      }

      // Map booking confirmations to orders
      const ordersWithConfirmations = (ordersData ?? []).map((order) => ({
        ...order,
        booking_confirmation:
          (confirmationsData ?? []).find(
            (conf) => conf.order_id === order.id
          ) || null,
      }));

      // Map orders to tours based on travel_choice and departureDate
      const mappedTours: Tour[] = (toursData ?? []).map((tour: any) => {
        const matchingOrder = ordersWithConfirmations.find(
          (order) =>
            order.travel_choice?.toLowerCase() === tour.title?.toLowerCase() &&
            order.departureDate === tour.departuredate
        );
        const confirmation = matchingOrder?.booking_confirmation || null;
        return {
          id: tour.id,
          title: tour.title,
          seats: tour.seats ?? 0,
          departure_date: tour.departuredate || "",
          status: tour.status,
          show_in_provider: tour.show_in_provider,
          description: tour.description || "",
          creator_name: tour.creator_name || "",
          tour_number: tour.tour_number || null,
          name: tour.name || tour.title,
          dates: tour.dates || [],
          hotels: tour.hotels || [],
          services: tour.services || [],
          created_by: tour.created_by || "",
          created_at: tour.created_at || "",
          updated_at: tour.updated_at || "",
          base_price: tour.base_price ?? 0,
          available_seats: tour.available_seats ?? 0,
          booking_confirmation: confirmation
            ? {
                order_id: confirmation.order_id,
                bus_number: confirmation.bus_number,
                guide_name: confirmation.guide_name,
                weather_emergency: confirmation.weather_emergency,
                updated_by: confirmation.updated_by,
                updated_at: confirmation.updated_at,
                passenger_count: matchingOrder?.passenger, // Map orders.passenger to passenger_count
                updated_by_email: confirmation.updated_by,
              }
            : null,
        };
      });

      setTours(mappedTours);
      console.log("Fetched and mapped tours with confirmations:", mappedTours);
    } catch (error) {
      console.error("Unexpected error fetching tours:", error);
      toast.error("Unexpected error fetching tours.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscriptions for tours, orders, and booking confirmations
  useEffect(() => {
    fetchTours();

    const toursSubscription = supabase
      .channel("tours_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tours" },
        (payload) => {
          console.log("Tours table changed:", payload);
          fetchTours();
        }
      )
      .subscribe((status) => {
        console.log("Tours subscription status:", status);
      });

    const ordersSubscription = supabase
      .channel("orders_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          console.log("Orders table changed:", payload);
          fetchTours();
        }
      )
      .subscribe((status) => {
        console.log("Orders subscription status:", status);
      });

    const confirmationsSubscription = supabase
      .channel("booking_confirmations_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_confirmations" },
        (payload) => {
          console.log("Booking confirmations table changed:", payload);
          fetchTours();
        }
      )
      .subscribe((status) => {
        console.log("Booking confirmations subscription status:", status);
      });

    return () => {
      console.log("Unsubscribing from channels");
      supabase.removeChannel(toursSubscription);
      supabase.removeChannel(ordersSubscription);
      supabase.removeChannel(confirmationsSubscription);
    };
  }, [userRole, setTours]);

  // Schema refresh
  useEffect(() => {
    const refreshSchemaCache = async () => {
      try {
        const { data, error } = await supabase
          .from("tours")
          .select(
            `
            id,
            title,
            seats,
            departuredate,
            status,
            show_in_provider,
            description,
            creator_name,
            tour_number,
            name,
            dates,
            hotels,
            services,
            created_by,
            created_at,
            updated_at,
            base_price
          `
          )
          .limit(1);
        if (error) {
          console.error("Error refreshing schema cache:", error);
          toast.error(`Schema refresh failed: ${error.message}`);
          return;
        }
        console.log("Schema refresh data:", data);
        const { data: schemaData, error: schemaError } = await supabase.rpc(
          "get_table_columns",
          { table_name: "tours" }
        );
        if (schemaError) {
          console.error("Error fetching schema:", schemaError);
          toast.error(`Failed to fetch schema: ${schemaError.message}`);
          return;
        }
        console.log("Tours table schema:", schemaData);
      } catch (error) {
        console.error("Unexpected error refreshing schema:", error);
      }
    };
    refreshSchemaCache();
  }, []);

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
    const startDate = dateFilterStart ? new Date(dateFilterStart) : null;
    const endDate = dateFilterEnd ? new Date(dateFilterEnd) : null;

    const matchesDate =
      (!startDate || (tourDate && tourDate >= startDate)) &&
      (!endDate || (tourDate && tourDate <= endDate));

    return matchesTitle && matchesStatus && matchesDate && matchesView;
  });

  const handleTourChange = async (
    tourId: string,
    field: keyof Tour,
    value: any
  ) => {
    const previousTours = [...tours];
    const updatedTours = tours.map((t) =>
      t.id === tourId ? { ...t, [field]: value } : t
    );
    setTours(updatedTours);

    try {
      const dbField = field === "departure_date" ? "departuredate" : field;
      const updateData: Partial<Tour> = {
        [dbField]: value,
        updated_at: new Date().toISOString(),
      };
      console.log(`Updating tour ${tourId}, field: ${dbField}, value:`, value);
      const { error } = await supabase
        .from("tours")
        .update(updateData)
        .eq("id", tourId);

      if (error) {
        console.error(`Error updating ${field}:`, error);
        toast.error(`Failed to update ${field}: ${error.message}`);
        setTours(previousTours);
      } else {
        toast.success(`${field} updated successfully!`);
      }
    } catch (error) {
      console.error(`Unexpected error updating ${field}:`, error);
      toast.error(`Unexpected error updating ${field}.`);
      setTours(previousTours);
    }
  };

  const handleDeleteTour = async (tourId: string) => {
    const previousTours = [...tours];
    setTours((prev) => prev.filter((t) => t.id !== tourId));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", tourId);

      if (error) {
        console.error("Error deleting tour:", error);
        toast.error(`Failed to delete tour: ${error.message}`);
        setTours(previousTours);
      } else {
        toast.success("Tour deleted successfully!");
      }
    } catch (error) {
      console.error("Unexpected error deleting tour:", error);
      toast.error("Unexpected error deleting tour.");
      setTours(previousTours);
    }
    setShowDeleteConfirm(null);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "Not set";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

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
    refreshTours: fetchTours,
    loading,
  };
}
