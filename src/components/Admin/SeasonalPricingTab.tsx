import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Calendar } from 'lucide-react';
import type { SeasonalPricing } from '../../types/chat';
import { fetchSeasonalPricing, createSeasonalPricing, updateSeasonalPricing, deleteSeasonalPricing } from '../../api/chat';

interface SeasonalPricingTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface EditingPricing {
  id: string | null;
  destination: string;
  start_date: string;
  end_date: string;
  multiplier: number;
}

const emptyPricing: EditingPricing = {
  id: null,
  destination: 'Монгол',
  start_date: '',
  end_date: '',
  multiplier: 1.00,
};

export default function SeasonalPricingTab({ showNotification }: SeasonalPricingTabProps) {
  const [pricings, setPricings] = useState<SeasonalPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingPricing | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadPricings = async () => {
    setLoading(true);
    try {
      const data = await fetchSeasonalPricing();
      setPricings(data);
    } catch (err) {
      showNotification('error', 'Сезон ачааллахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricings();
  }, []);

  const handleEdit = (pricing: SeasonalPricing) => {
    setEditing({
      id: pricing.id,
      destination: pricing.destination,
      start_date: pricing.start_date,
      end_date: pricing.end_date,
      multiplier: pricing.multiplier,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyPricing });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing) return;

    try {
      if (isAdding) {
        await createSeasonalPricing({
          destination: editing.destination,
          start_date: editing.start_date,
          end_date: editing.end_date,
          multiplier: editing.multiplier,
          is_active: true,
        });
        showNotification('success', 'Шинэ сезон нэмэгдлээ');
      } else if (editing.id) {
        await updateSeasonalPricing(editing.id, {
          destination: editing.destination,
          start_date: editing.start_date,
          end_date: editing.end_date,
          multiplier: editing.multiplier,
        });
        showNotification('success', 'Сезон шинэчлэгдлээ');
      }
      setEditing(null);
      setIsAdding(false);
      loadPricings();
    } catch (err) {
      showNotification('error', 'Хадгалахад алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Та энэ сезоныг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      await deleteSeasonalPricing(id);
      showNotification('success', 'Сезон устгагдлаа');
      loadPricings();
    } catch (err) {
      showNotification('error', 'Устахад алдаа гарлаа');
    }
  };

  const handleCancel = () => {
    setEditing(null);
    setIsAdding(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('mn-MN');
  };

  const formatMultiplier = (mult: number) => {
    const percent = Math.round((mult - 1) * 100);
    if (percent > 0) return `+${percent}%`;
    if (percent < 0) return `${percent}%`;
    return 'Стандарт';
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
          Сезон үнэ
        </h2>
        <button
          onClick={handleAdd}
          className="mono-button flex items-center gap-2"
          disabled={isAdding}
        >
          <Plus className="w-4 h-4" />
          Шинээр нэмэх
        </button>
      </div>

      {(editing || isAdding) && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-800">
            {isAdding ? 'Шинэ сезон' : 'Засах'}
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Зорилго</label>
              <input
                type="text"
                value={editing?.destination || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, destination: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Монгол"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Үржүүлэгч (1.00 = стандарт)</label>
              <input
                type="number"
                step="0.01"
                min="0.5"
                max="3"
                value={editing?.multiplier || 1}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, multiplier: parseFloat(e.target.value) || 1 }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1.30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Эхлэх огноо</label>
              <input
                type="date"
                value={editing?.start_date || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, start_date: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Дуусах огноо</label>
              <input
                type="date"
                value={editing?.end_date || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, end_date: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Зорилго</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Эхлэх</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Дуусах</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Үржүүлэгч</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {pricings.map((pricing) => (
              <tr key={pricing.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{pricing.destination}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(pricing.start_date)}</td>
                <td className="px-4 py-3 text-gray-600">{formatDate(pricing.end_date)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    pricing.multiplier > 1 ? 'bg-red-100 text-red-700' :
                    pricing.multiplier < 1 ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {formatMultiplier(pricing.multiplier)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(pricing)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Засах">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(pricing.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Устгах">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pricings.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          Сезон олдсонгүй
        </div>
      )}
    </div>
  );
}
