import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Plane, PlaneTakeoff, PlaneLanding } from 'lucide-react';
import { fetchToursForChat, fetchTourFlights, createTourFlight, updateTourFlight, deleteTourFlight } from '../../api/chat';

interface TourFlightsTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface Tour {
  id: string;
  title: string;
  name: string;
}

interface TourFlight {
  id: string;
  tour_id: string;
  airline: string;
  departure_time: string | null;
  arrival_time: string | null;
  price_modifier: number;
  flight_class: 'economy' | 'business' | 'first' | null;
  is_active: boolean;
  created_at: string;
}

interface EditingFlight {
  id: string | null;
  airline: string;
  departure_time: string;
  arrival_time: string;
  price_modifier: number;
  flight_class: 'economy' | 'business' | 'first';
  is_active: boolean;
}

const emptyFlight: EditingFlight = {
  id: null,
  airline: '',
  departure_time: '',
  arrival_time: '',
  price_modifier: 0,
  flight_class: 'economy',
  is_active: true,
};

const flightClassOptions = [
  { value: 'economy', label: 'Эконом' },
  { value: 'business', label: 'Бизнес' },
  { value: 'first', label: 'Перший класс' },
];

export default function TourFlightsTab({ showNotification }: TourFlightsTabProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [flights, setFlights] = useState<TourFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFlights, setLoadingFlights] = useState(false);
  const [editing, setEditing] = useState<EditingFlight | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadTours = async () => {
    try {
      const data = await fetchToursForChat();
      setTours(data || []);
    } catch (err) {
      console.error('Failed to load tours:', err);
    }
  };

  const loadFlights = async (tourId: string) => {
    if (!tourId) {
      setFlights([]);
      return;
    }
    setLoadingFlights(true);
    try {
      const data = await fetchTourFlights(tourId);
      setFlights(data || []);
    } catch (err) {
      showNotification('error', 'Нислэг ачааллахад алдаа гарлаа');
    } finally {
      setLoadingFlights(false);
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
      loadFlights(selectedTourId);
    } else {
      setFlights([]);
    }
  }, [selectedTourId]);

  const handleEdit = (flight: TourFlight) => {
    setEditing({
      id: flight.id,
      airline: flight.airline,
      departure_time: flight.departure_time || '',
      arrival_time: flight.arrival_time || '',
      price_modifier: flight.price_modifier,
      flight_class: flight.flight_class || 'economy',
      is_active: flight.is_active,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyFlight });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing || !selectedTourId) return;

    if (!editing.airline) {
      showNotification('error', 'Ави компани сонгоно уу');
      return;
    }

    try {
      const data: any = {
        tour_id: selectedTourId,
        airline: editing.airline,
        price_modifier: editing.price_modifier,
        flight_class: editing.flight_class,
        is_active: editing.is_active,
      };

      if (editing.departure_time) {
        data.departure_time = editing.departure_time;
      }
      if (editing.arrival_time) {
        data.arrival_time = editing.arrival_time;
      }

      if (isAdding) {
        await createTourFlight(data);
        showNotification('success', 'Шинэ нислэг нэмэгдлээ');
      } else if (editing.id) {
        await updateTourFlight(editing.id, data);
        showNotification('success', 'Нислэг шинэчлэгдлээ');
      }
      setEditing(null);
      setIsAdding(false);
      loadFlights(selectedTourId);
    } catch (err) {
      showNotification('error', 'Хадгалахад алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Та энэ нислэгийг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      await deleteTourFlight(id);
      showNotification('success', 'Нислэг устгагдлаа');
      loadFlights(selectedTourId);
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
          <Plane className="w-5 h-5" />
          Нислэг
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
          <Plane className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Аялал сонгоно уу</p>
        </div>
      )}

      {selectedTourId && loadingFlights && (
        <div className="text-center py-8 text-gray-500">
          Нислэг ачааллаж байна...
        </div>
      )}

      {selectedTourId && !loadingFlights && flights.length === 0 && !editing && (
        <div className="text-center py-8 text-gray-500">
          <p>Энэ аяллаар нислэг олдсонгүй</p>
          <button onClick={handleAdd} className="mt-2 mono-button">
            Шинээр нэмэх
          </button>
        </div>
      )}

      {(editing || isAdding) && selectedTourId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-800">
            {isAdding ? 'Шинэ нислэг' : 'Засах'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ави компани *</label>
              <input
                type="text"
                value={editing?.airline || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, airline: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="MIAT, Korean Air, Aeroflot..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Класс</label>
              <select
                value={editing?.flight_class || 'economy'}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, flight_class: e.target.value as 'economy' | 'business' | 'first' }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {flightClassOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Явсан цаг</label>
              <input
                type="time"
                value={editing?.departure_time || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, departure_time: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ирсэн цаг</label>
              <input
                type="time"
                value={editing?.arrival_time || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, arrival_time: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {selectedTourId && flights.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ави компани</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Класс</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Явсан</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ирсэн</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Үнэ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Төлөв</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((flight) => (
                <tr key={flight.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{flight.airline}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {flightClassOptions.find(o => o.value === flight.flight_class)?.label || flight.flight_class || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{flight.departure_time || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{flight.arrival_time || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{flight.price_modifier.toLocaleString()} ₮</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${flight.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {flight.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(flight)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Засах">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(flight.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Устгах">
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