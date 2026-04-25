import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, List, Calendar } from 'lucide-react';
import { fetchToursForChat, fetchTourDates, createTourDate, updateTourDate, deleteTourDate } from '../../api/chat';

interface TourDatesTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface Tour {
  id: string;
  title: string;
  name: string;
}

interface TourDate {
  id: string;
  tour_id: string;
  departure_date: string;
  return_date: string | null;
  available_seats: number;
  price_modifier: number;
  is_active: boolean;
  created_at: string;
}

interface EditingDate {
  id: string | null;
  departure_date: string;
  return_date: string;
  available_seats: number;
  price_modifier: number;
  is_active: boolean;
}

const emptyDate: EditingDate = {
  id: null,
  departure_date: '',
  return_date: '',
  available_seats: 0,
  price_modifier: 0,
  is_active: true,
};

export default function TourDatesTab({ showNotification }: TourDatesTabProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [dates, setDates] = useState<TourDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDates, setLoadingDates] = useState(false);
  const [editing, setEditing] = useState<EditingDate | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadTours = async () => {
    try {
      const data = await fetchToursForChat();
      setTours(data || []);
    } catch (err) {
      console.error('Failed to load tours:', err);
    }
  };

  const loadDates = async (tourId: string) => {
    if (!tourId) {
      setDates([]);
      return;
    }
    setLoadingDates(true);
    try {
      const data = await fetchTourDates(tourId);
      setDates(data || []);
    } catch (err) {
      showNotification('error', 'Өдрүүд ачааллахад алдаа гарлаа');
    } finally {
      setLoadingDates(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadTours();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedTourId) {
      loadDates(selectedTourId);
    } else {
      setDates([]);
    }
  }, [selectedTourId]);

  const handleEdit = (date: TourDate) => {
    setEditing({
      id: date.id,
      departure_date: date.departure_date.split('T')[0] || date.departure_date || '',
      return_date: date.return_date ? (date.return_date.split('T')[0] || date.return_date) : '',
      available_seats: date.available_seats,
      price_modifier: date.price_modifier,
      is_active: date.is_active,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyDate });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing || !selectedTourId) return;

    if (!editing.departure_date) {
      showNotification('error', 'Өдөр сонгоно уу');
      return;
    }

    try {
      const data: any = {
        tour_id: selectedTourId,
        departure_date: editing.departure_date,
        available_seats: editing.available_seats,
        price_modifier: editing.price_modifier,
        is_active: editing.is_active,
      };

      if (editing.return_date) {
        data.return_date = editing.return_date;
      }

      if (isAdding) {
        await createTourDate(data);
        showNotification('success', 'Шинэ өдөр нэмэгдлээ');
      } else if (editing.id) {
        await updateTourDate(editing.id, data);
        showNotification('success', 'Өдөр шинэчлэгдлээ');
      }
      setEditing(null);
      setIsAdding(false);
      loadDates(selectedTourId);
    } catch (err) {
      showNotification('error', 'Хадгалахад алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Та энэ өдрийг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      await deleteTourDate(id);
      showNotification('success', 'Өдөр устгагдлаа');
      loadDates(selectedTourId);
    } catch (err) {
      showNotification('error', 'Устахад алдаа гарлаа');
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setIsAdding(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Ачааллаж байна...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="mono-title text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Аялын өдрүүд
        </h2>
      </div>

      {/* Tour Selector */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Аялал сонгоно уу</label>
          <select
            value={selectedTourId}
            onChange={(e) => setSelectedTourId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Аялал сонгоно уу...</option>
            {tours.map((tour) => (
              <option key={tour.id} value={tour.id}>
                {tour.title || tour.name}
              </option>
            ))}
          </select>
        </div>
        {selectedTourId && (
          <button
            onClick={handleAdd}
            disabled={isAdding}
            className="mono-button flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Шинээр нэмэх
          </button>
        )}
      </div>

      {!selectedTourId && (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Аялал сонгоно уу</p>
        </div>
      )}

      {selectedTourId && loadingDates && (
        <div className="text-center py-8 text-gray-500">
          Өдрүүд ачааллаж байна...
        </div>
      )}

      {selectedTourId && !loadingDates && dates.length === 0 && !editing && (
        <div className="text-center py-8 text-gray-500">
          <p>Энэ аяллаар өдөр олдсонгүй</p>
          <button onClick={handleAdd} className="mt-2 mono-button">
            Шинээр нэмэх
          </button>
        </div>
      )}

      {(editing || isAdding) && selectedTourId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-800">
            {isAdding ? 'Шинэ өдөр' : 'Засах'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Явсан өдөр *</label>
              <input
                type="date"
                value={editing?.departure_date || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, departure_date: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Буцсан өдөр</label>
              <input
                type="date"
                value={editing?.return_date || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, return_date: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Свободных мест</label>
              <input
                type="number"
                value={editing?.available_seats || 0}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, available_seats: parseInt(e.target.value) || 0 }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Үнэ (MNT)</label>
              <input
                type="number"
                value={editing?.price_modifier || 0}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, price_modifier: parseInt(e.target.value) || 0 }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing?.is_active ?? true}
                  onChange={(e) => setEditing(prev => prev ? ({ ...prev, is_active: e.target.checked }) : null)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Идэвхтэй</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} className="mono-button mono-button--primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              Хадгалах
            </button>
            <button onClick={handleCancel} className="mono-button mono-button--ghost flex items-center gap-2">
              <X className="w-4 h-4" />
              Цуцлах
            </button>
          </div>
        </div>
      )}

      {selectedTourId && dates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Явсан өдөр</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Буцсан өдөр</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Свободних мест</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Үнэ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Төлөв</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => (
                <tr key={date.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {date.departure_date ? new Date(date.departure_date).toLocaleDateString('mn-MN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {date.return_date ? new Date(date.return_date).toLocaleDateString('mn-MN') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{date.available_seats}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{date.price_modifier.toLocaleString()} ₮</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${date.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {date.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(date)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Засах">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(date.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Устгах">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}