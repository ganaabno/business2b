import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, List } from 'lucide-react';
import type { ItineraryItem } from '../../types/chat';
import { fetchItineraryItems, createItineraryItem, updateItineraryItem, deleteItineraryItem } from '../../api/chat';
import { formatMnt } from '../../utils/priceCalculator';

interface ItineraryItemsTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface EditingItem {
  id: string | null;
  name: string;
  name_en: string;
  description: string;
  price_model: 'per_day' | 'per_person' | 'fixed';
  price_value: number;
}

const emptyItem: EditingItem = {
  id: null,
  name: '',
  name_en: '',
  description: '',
  price_model: 'fixed',
  price_value: 0,
};

const priceModelLabels: Record<string, string> = {
  per_day: 'Хоног',
  per_person: 'Хүн',
  fixed: 'Тогтмол',
};

export default function ItineraryItemsTab({ showNotification }: ItineraryItemsTabProps) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await fetchItineraryItems();
      setItems(data);
    } catch (err) {
      showNotification('error', 'Үйлчилгээ ачааллахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleEdit = (item: ItineraryItem) => {
    setEditing({
      id: item.id,
      name: item.name,
      name_en: item.name_en || '',
      description: item.description || '',
      price_model: item.price_model,
      price_value: item.price_value,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyItem });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing) return;

    try {
      if (isAdding) {
        await createItineraryItem({
          name: editing.name,
          name_en: editing.name_en,
          description: editing.description,
          price_model: editing.price_model,
          price_value: editing.price_value,
          is_active: true,
        });
        showNotification('success', 'Шинэ үйлчилгээ нэмэгдлээ');
      } else if (editing.id) {
        await updateItineraryItem(editing.id, {
          name: editing.name,
          name_en: editing.name_en,
          description: editing.description,
          price_model: editing.price_model,
          price_value: editing.price_value,
        });
        showNotification('success', 'Үйлчилгээ шинэчлэгдлээ');
      }
      setEditing(null);
      setIsAdding(false);
      loadItems();
    } catch (err) {
      showNotification('error', 'Хадгалахад алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Та энэ үйлчилгээг устгахдаа итгэлтэй байна уу?')) return;
    
    try {
      await deleteItineraryItem(id);
      showNotification('success', 'Үйлчилгээ устгагдлаа');
      loadItems();
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
          <List className="w-5 h-5" />
          Үйлчилгээний төрөл
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
                placeholder="Гид, Хоол..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Нэр (EN)</label>
              <input
                type="text"
                value={editing?.name_en || ''}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, name_en: e.target.value }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Guide, Meals..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Үнэ Model</label>
              <select
                value={editing?.price_model || 'fixed'}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, price_model: e.target.value as any }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="fixed">Тогтмол</option>
                <option value="per_day">Хоног</option>
                <option value="per_person">Хүн</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Үнэ</label>
              <input
                type="number"
                value={editing?.price_value || 0}
                onChange={(e) => setEditing(prev => prev ? ({ ...prev, price_value: parseInt(e.target.value) || 0 }) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Нэр</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Тайлбар</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Үнэ Model</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Үнэ</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                <td className="px-4 py-3 text-gray-600">{item.description}</td>
                <td className="px-4 py-3 text-right text-gray-600">{priceModelLabels[item.price_model]}</td>
                <td className="px-4 py-3 text-right text-gray-600">{formatMnt(item.price_value)}</td>
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

      {items.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          Үйлчилгээ олдсонгүй
        </div>
      )}
    </div>
  );
}
