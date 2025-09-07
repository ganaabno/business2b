import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-toastify';
import type { Tour } from '../types/type';

export function useTours(tours: Tour[], setTours: React.Dispatch<React.SetStateAction<Tour[]>>) {
  const [titleFilter, setTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'hidden'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Refresh schema cache and log schema
  useEffect(() => {
    const refreshSchemaCache = async () => {
      try {
        // Explicitly select departuredate to force cache update
        const { data, error } = await supabase.from('tours').select('id, departuredate, title, name').limit(1);
        if (error) {
          console.error('Error refreshing schema cache:', error);
          toast.error(`Schema refresh failed: ${error.message}`);
          return;
        }
        console.log('Schema refresh data:', data);
        // Log full schema
        const { data: schemaData, error: schemaError } = await supabase
          .rpc('get_table_columns', { table_name: 'tours' });
        if (schemaError) {
          console.error('Error fetching schema:', schemaError);
          toast.error(`Failed to fetch schema: ${schemaError.message}`);
          return;
        }
        console.log('Tours table schema:', schemaData);
      } catch (error) {
        console.error('Unexpected error refreshing schema:', error);
      }
    };
    refreshSchemaCache();
  }, []);

  const filteredTours = tours.filter((tour) => {
    const matchesTitle = tour.title.toLowerCase().includes(titleFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tour.status === statusFilter;
    const matchesView = viewFilter === 'all' || (viewFilter === 'hidden' && !tour.show_in_provider);
    const tourDate = tour.departureDate ? new Date(tour.departureDate) : null;
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
      // Map departureDate to departuredate for DB
      const dbField = field === 'departureDate' ? 'departuredate' : field;
      const updateData: Partial<Tour> = { [dbField]: value, updated_at: new Date().toISOString() };
      console.log(`Updating tour ${tourId}, field: ${dbField}, value:`, value);
      const { error } = await supabase
        .from('tours')
        .update(updateData)
        .eq('id', tourId);

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
        .from('tours')
        .delete()
        .eq('id', tourId);

      if (error) {
        console.error('Error deleting tour:', error);
        toast.error(`Failed to delete tour: ${error.message}`);
        setTours(previousTours);
      } else {
        toast.success('Tour deleted successfully!');
      }
    } catch (error) {
      console.error('Unexpected error deleting tour:', error);
      toast.error('Unexpected error deleting tour.');
      setTours(previousTours);
    }
    setShowDeleteConfirm(null);
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

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
    viewFilter,
    setViewFilter,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleTourChange,
    handleDeleteTour,
    formatDisplayDate,
  };
}