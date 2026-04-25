import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Building2, Star } from 'lucide-react';
import { fetchToursForChat, fetchTourHotels, createTourHotel, updateTourHotel, deleteTourHotel } from '../../api/chat';

interface TourHotelsTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface Tour {
  id: string;
  title: string;
  name: string;
}

interface TourHotel {
  id: string;
  tour_id: string;
  name: string;
  star_rating: number;
  price_per_night: number | null;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface EditingHotel {
  id: string | null;
  name: string;
  star_rating: number;
  price_per_night: number;
  description: string;
  image_url: string;
  is_active: boolean;
}

const emptyHotel: EditingHotel = {
  id: null,
  name: '',
  star_rating: 3,
  price_per_night: 0,
  description: '',
  image_url: '',
  is_active: true,
};

const starRatingOptions = [
  { value: 1, label: '1 ★' },
  { value: 2, label: '2 ★★' },
  { value: 3, label: '3 ★★★' },
  { value: 4, label: '4 ★★★★' },
  { value: 5, label: '5 ★★★★★' },
];

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-500">
      {'★'.repeat(rating)}
      <span className="text-gray-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

export default function TourHotelsTab({ showNotification }: TourHotelsTabProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [hotels, setHotels] = useState<TourHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [editing, setEditing] = useState<EditingHotel | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadTours = async () => {
    try {
      const data = await fetchToursForChat();
      setTours(data || []);
    } catch (err) {
      console.error('Failed to load tours:', err);
    }
  };

  const loadHotels = async (tourId: string) => {
    if (!tourId) {
      setHotels([]);
      return;
    }
    setLoadingHotels(true);
    try {
      const data = await fetchTourHotels(tourId);
      setHotels(data || []);
    } catch (err) {
      showNotification('error', 'Зочид ачааллахад алдаа гарлаа');
    } finally {
      setLoadingHotels(false);
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
      loadHotels(selectedTourId);
    } else {
      setHotels([]);
    }
  }, [selectedTourId]);

  const handleEdit = (hotel: TourHotel) => {
    setEditing({
      id: hotel.id,
      name: hotel.name,
      star_rating: hotel.star_rating,
      price_per_night: hotel.price_per_night || 0,
      description: hotel.description || '',
      image_url: hotel.image_url || '',
      is_active: hotel.is_active,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyHotel });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing || !selectedTourId) return;

    if (!editing.name) {
      showNotification('error', 'Зочид буултын нэр сонгоно уу');
      return;
    }

    try {
      const data: any = {
        tour_id: selectedTourId,
        name: editing.name,
        star_rating: editing.star_rating,
        is_active: editing.is_active,
      };

      if (editing.price_per_night > 0) {
        data.price_per_night = editing.price_per_night;
      }
      if (editing.description) {
        data.description = editing.description;
      }
      if (editing.image_url) {
        data.image_url = editing.image_url;
      }

      if (isAdding) {
        await createTourHotel(data);
        showNotification('success', 'Шинэ зочид буудал нэмэгдлээ');
      } else if (editing.id) {
        await updateTourHotel(editing.id, data);
        showNotification('success', 'Зочид буудал шинэчлэгдлээ');
      }
      setEditing(null);
      setIsAdding(false);
      loadHotels(selectedTourId);
    } catch (err) {
      showNotification('error', 'Хадгалахад алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Та энэ зочид буудлыг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      await deleteTourHotel(id);
      showNotification('success', 'Зочид буудал устгагдлаа');
      loadHotels(selectedTourId);
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
          <Building2 className="w-5 h-5" />
          Зочид буудал
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
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Аялал сонгоно уу</p>
        </div>
      )}

      {selectedTourId && loadingHotels && (
        <div className="text-center py-8 text-gray-500">
          Зочид ачааллаж байна...
        </div>
      )}

      {selectedTourId && !loadingHotels && hotels.length === 0 && !editing && (
        <div className="text-center py-8 text-gray-500">
          <p>Энэ аяллаар зочид буудал олдсонгүй</p>
          <button onClick={handleAdd} className="mt-2 mono-button">
            Шинээр нэмэх
          </button>
        </div>
      )}

      {(editing || isAdding) && selectedTourId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-800">
            {isAdding ? 'Шинэ зочид буудал' : 'Засах'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Нэр *</label>
              <input
                type="text"
                value={editing?.name || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Зочид буултын нэр..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ангилал</label>
              <select
                value={editing?.star_rating || 3}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, star_rating: parseInt(e.target.value) }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {starRatingOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Шөнийн үнэ (MNT)</label>
              <input
                type="number"
                value={editing?.price_per_night || 0}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, price_per_night: parseInt(e.target.value) || 0 }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
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
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Тайлбар</label>
              <input
                type="text"
                value={editing?.description || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Зочид буултын тайлбар..."
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Зураг URL</label>
              <input
                type="url"
                value={editing?.image_url || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, image_url: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
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

      {selectedTourId && hotels.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Нэр</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Ангилал</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Шөнийн үнэ</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Тайлбар</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Төлөв</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel) => (
                <tr key={hotel.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{hotel.name}</td>
                  <td className="px-4 py-3 text-center">
                    <StarRatingDisplay rating={hotel.star_rating} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {hotel.price_per_night ? `${hotel.price_per_night.toLocaleString()} ₮` : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{hotel.description || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${hotel.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {hotel.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(hotel)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Засах">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(hotel.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Устгах">
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