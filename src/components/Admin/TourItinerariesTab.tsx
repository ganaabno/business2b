import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, List, Search } from 'lucide-react';
import type { TourItinerary } from '../../types/chat';
import { fetchToursForChat, fetchTourItineraries, createTourItinerary, updateTourItinerary, deleteTourItinerary } from '../../api/chat';
import { formatMnt } from '../../utils/priceCalculator';

interface TourItinerariesTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface Tour {
  id: string;
  title: string;
  name: string;
}

interface EditingItem {
  id: string | null;
  name: string;
  name_en: string;
  description: string;
  price_modifier: number;
  is_active: boolean;
}

const emptyItem: EditingItem = {
  id: null,
  name: '',
  name_en: '',
  description: '',
  price_modifier: 0,
  is_active: true,
};

export default function TourItinerariesTab({ showNotification }: TourItinerariesTabProps) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [activities, setActivities] = useState<TourItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadTours = async () => {
    try {
      const data = await fetchToursForChat();
      setTours(data || []);
    } catch (err) {
      console.error('Failed to load tours:', err);
    }
  };

  const loadActivities = async (tourId: string) => {
    if (!tourId) {
      setActivities([]);
      return;
    }
    setLoadingActivities(true);
    try {
      const data = await fetchTourItineraries(tourId);
      setActivities(data || []);
    } catch (err) {
      showNotification('error', 'Үйлчилгээ ачааллахад алдаа гарлаа');
    } finally {
      setLoadingActivities(false);
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
      loadActivities(selectedTourId);
    } else {
      setActivities([]);
    }
  }, [selectedTourId]);

  const handleEdit = (item: TourItinerary) => {
    setEditing({
      id: item.id,
      name: item.name,
      name_en: item.name_en || '',
      description: item.description || '',
      price_modifier: item.price_modifier,
      is_active: item.is_active,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyItem });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing || !selectedTourId) return;

    try {
      if (isAdding) {
        await createTourItinerary({
          tour_id: selectedTourId,
          name: editing.name,
          name_en: editing.name_en,
          description: editing.description,
          price_modifier: editing.price_modifier,
          is_active: editing.is_active,
        });
        showNotification('success', 'Шинэ үйлчилгээ нэмэгдлээ');
      } else if (editing.id) {
        await updateTourItinerary(editing.id, {
          name: editing.name,
          name_en: editing.name_en,
          description: editing.description,
          price_modifier: editing.price_modifier,
          is_active: editing.is_active,
        });
        showNotification('success', 'Үйлчилгээ шинэчлэгдлээ');
      }
      setEditing(null);
      setIsAdding(false);
      loadActivities(selectedTourId);
    } catch (err) {
      showNotification('error', 'Хадгалахад алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Та энэ үйлчилгээг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      await deleteTourItinerary(id);
      showNotification('success', 'Үйлчилгээ устгагдлаа');
      loadActivities(selectedTourId);
    } catch (err) {
      showNotification('error', 'Устахад алдаа гарлаа');
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setIsAdding(false);
  };

  const selectedTour = tours.find(t => t.id === selectedTourId);

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
          <List className="w-5 h-5" />
          Аялын үйлчилгээ
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
          <List className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Аялал сонгоно уу</p>
        </div>
      )}

      {selectedTourId && loadingActivities && (
        <div className="text-center py-8 text-gray-500">
          Үйлчилгээ ачааллаж байна...
        </div>
      )}

      {selectedTourId && !loadingActivities && activities.length === 0 && !editing && (
        <div className="text-center py-8 text-gray-500">
          <p>Энэ аяллаар үйлчилгээ олдсонгүй</p>
          <button
            onClick={handleAdd}
            className="mt-2 mono-button"
          >
            Шинээр нэмэх
          </button>
        </div>
      )}

      {(editing || isAdding) && selectedTourId && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-800">
            {isAdding ? 'Шинэ үйлчилгээ' : 'Засах'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Нэр (MN)</label>
              <input
                type="text"
                value={editing?.name || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Музей, Шоу..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Нэр (EN)</label>
              <input
                type="text"
                value={editing?.name_en || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, name_en: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Museum, Show..."
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
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Тайлбар</label>
              <input
                type="text"
                value={editing?.description || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Үйлчилгээний тайлбар..."
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

      {selectedTourId && activities.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Нэр</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Тайлбар</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Үнэ</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Төлөв</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.description}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatMnt(item.price_modifier)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(item)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Засах">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Устгах">
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