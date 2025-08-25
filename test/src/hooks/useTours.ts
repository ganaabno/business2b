import { useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import type { Tour } from "../types/type";
import { formatDate } from "../utils/tourUtils";

export const useTours = (initialTours: Tour[], setTours: React.Dispatch<React.SetStateAction<Tour[]>>) => {
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilterStart, setDateFilterStart] = useState<string>("");
  const [dateFilterEnd, setDateFilterEnd] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleTourChange = async (id: string, field: keyof Tour, value: any) => {
    const previousTours = [...initialTours];
    const updatedTours = initialTours.map((t) => (t.id === id ? { ...t, [field]: value } : t));
    setTours(updatedTours);
    try {
      const { error } = await supabase
        .from("tours")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } catch (error) {
      console.error("Error updating tour:", error);
      setTours(previousTours);
    }
  };

  const handleDeleteTour = async (id: string) => {
    const previousTours = [...initialTours];
    setTours(initialTours.filter((t) => t.id !== id));
    try {
      const { error } = await supabase.from("tours").delete().eq("id", id);
      if (error) throw error;
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting tour:", error);
      setTours(previousTours);
    }
  };

  const filteredTours = useMemo(() => {
    return initialTours.filter((tour) => {
      const matchesTitle = tour.title.toLowerCase().includes(titleFilter.toLowerCase());
      const matchesStatus = statusFilter === "all" || tour.status === statusFilter;
      const tourDate = tour.dates?.[0];
      let matchesDate = true;

      if (tourDate) {
        const tourDateObj = new Date(tourDate);
        if (dateFilterStart) {
          const startDate = new Date(dateFilterStart);
          matchesDate = matchesDate && tourDateObj >= startDate;
        }
        if (dateFilterEnd) {
          const endDate = new Date(dateFilterEnd);
          matchesDate = matchesDate && tourDateObj <= endDate;
        }
      }

      return matchesTitle && matchesStatus && matchesDate;
    });
  }, [initialTours, titleFilter, statusFilter, dateFilterStart, dateFilterEnd]);

  return {
    filteredTours,
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    dateFilterStart,
    setDateFilterStart,
    dateFilterEnd,
    setDateFilterEnd,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleTourChange,
    handleDeleteTour,
    formatDate,
  };
};