import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { toast } from "react-toastify";
import type { Tour } from "../types/type";

interface UseToursProps {
  userRole: string;
  tours?: Tour[]; // Optional external tours state
  setTours?: React.Dispatch<React.SetStateAction<Tour[]>>; // Optional setter for external state
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
  handleTourChange: (tourId: string, field: keyof Tour, value: any) => Promise<void>;
  handleDeleteTour: (tourId: string) => Promise<void>;
  formatDisplayDate: (dateString: string) => string;
  refreshTours: () => Promise<void>;
  loading: boolean;
}

export function useTours({ userRole, tours: externalTours, setTours: setExternalTours }: UseToursProps): UseToursReturn {
  const [internalTours, setInternalTours] = useState<Tour[]>([]);
  const [titleFilter, setTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilterStart, setDateFilterStart] = useState("");
  const [dateFilterEnd, setDateFilterEnd] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "hidden">("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Use externalTours if provided, otherwise use internalTours
  const tours = externalTours ?? internalTours;
  const setTours = setExternalTours ?? setInternalTours;

  // Fetch tours with real-time subscription
  const fetchTours = async () => {
    setLoading(true);
    try {
      let query = supabase.from("tours").select(`
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
      `);
      if (userRole !== "admin" && userRole !== "superadmin") {
        query = query.eq("status", "active").eq("show_in_provider", true);
      }
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching tours:", error);
        toast.error(`Failed to fetch tours: ${error.message}`);
        return;
      }

      // Map Supabase data to Tour type
      const mappedTours: Tour[] = (data ?? []).map((tour: any) => ({
        id: tour.id,
        title: tour.title,
        seats: tour.seats ?? 0,
        departure_date: tour.departuredate || "",
        status: tour.status,
        show_in_provider: tour.show_in_provider,
        description: tour.description || "",
        creator_name: tour.creator_name || "",
        tour_number: tour.tour_number || null, // Align with Tour type (number | null)
        name: tour.name || tour.title,
        dates: tour.dates || [],
        hotels: tour.hotels || [],
        services: tour.services || [],
        created_by: tour.created_by || "",
        created_at: tour.created_at || "",
        updated_at: tour.updated_at || "",
        base_price: tour.base_price ?? 0,
        available_seats: tour.available_seats ?? 0, // Add if needed
        price_base: undefined, // Deprecated
      }));

      setTours(mappedTours);
      console.log("Fetched and mapped tours:", mappedTours);
    } catch (error) {
      console.error("Unexpected error fetching tours:", error);
      toast.error("Unexpected error fetching tours.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for tours
  useEffect(() => {
    fetchTours();

    const subscription = supabase
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

    return () => {
      console.log("Unsubscribing from tours_channel");
      supabase.removeChannel(subscription);
    };
  }, [userRole, setTours]);

  // Refresh schema cache and log schema
  useEffect(() => {
    const refreshSchemaCache = async () => {
      try {
        const { data, error } = await supabase
          .from("tours")
          .select(`
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
          `)
          .limit(1);
        if (error) {
          console.error("Error refreshing schema cache:", error);
          toast.error(`Schema refresh failed: ${error.message}`);
          return;
        }
        console.log("Schema refresh data:", data);
        const { data: schemaData, error: schemaError } = await supabase
          .rpc("get_table_columns", { table_name: "tours" });
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
    const matchesTitle = tour.title.toLowerCase().includes(titleFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || tour.status === statusFilter;
    const matchesView = viewFilter === "all" || (viewFilter === "hidden" && !tour.show_in_provider);
    const tourDate = tour.departure_date ? new Date(tour.departure_date) : null;
    const startDate = dateFilterStart ? new Date(dateFilterStart) : null;
    const endDate = dateFilterEnd ? new Date(dateFilterEnd) : null;

    const matchesDate =
      (!startDate || (tourDate && tourDate >= startDate)) &&
      (!endDate || (tourDate && tourDate <= endDate));

    return matchesTitle && matchesStatus && matchesDate && matchesView;
  });

  const handleTourChange = async (tourId: string, field: keyof Tour, value: any) => {
    const previousTours = [...tours];
    const updatedTours = tours.map((t) =>
      t.id === tourId ? { ...t, [field]: value } : t
    );
    setTours(updatedTours);

    try {
      const dbField = field === "departure_date" ? "departuredate" : field;
      const updateData: Partial<Tour> = { [dbField]: value, updated_at: new Date().toISOString() };
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
      const { error } = await supabase
        .from("tours")
        .delete()
        .eq("id", tourId);

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