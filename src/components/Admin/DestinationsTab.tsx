import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, MapPin, Globe } from 'lucide-react';
import type { Destination, FlightClass, VisaFee } from '../../types/chat';
import { toast } from 'react-toastify';

interface DestinationsTabProps {
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface EditingDestination {
  id: string | null;
  name: string;
  name_en: string;
  country: string;
  country_code: string;
  is_active: boolean;
  display_order: number;
}

const emptyDest: EditingDestination = {
  id: null,
  name: '',
  name_en: '',
  country: '',
  country_code: '',
  is_active: true,
  display_order: 0,
};

export default function DestinationsTab({ showNotification }: DestinationsTabProps) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingDestination | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<'destinations' | 'flightClasses' | 'visaFees'>('destinations');

  const loadData = async () => {
    setLoading(true);
    try {
      const { supabase } = await import('../../supabaseClient');
      const { data, error } = await supabase
        .from('destinations')
        .select('*')
        .order('display_order');
      
      if (error) throw error;
      setDestinations(data || []);
    } catch (err) {
      showNotification('error', 'Ачааллахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEdit = (dest: Destination) => {
    setEditing({
      id: dest.id,
      name: dest.name,
      name_en: dest.name_en || '',
      country: dest.country || '',
      country_code: dest.country_code || '',
      is_active: dest.is_active,
      display_order: dest.display_order,
    });
    setIsAdding(false);
  };

  const handleAdd = () => {
    setEditing({ ...emptyDest });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      showNotification('error', 'Нэр оруулна уу');
      return;
    }

    try {
      const { supabase } = await import('../../supabaseClient');
      
      if (isAdding) {
        const { error } = await supabase
          .from('destinations')
          .insert({
            name: editing.name,
            name_en: editing.name_en,
            country: editing.country,
            country_code: editing.country_code,
            is_active: editing.is_active,
            display_order: editing.display_order,
          });
        
        if (error) throw error;
        showNotification('success', 'Шинэ чиглэл нэмэгдлээ');
      } else if (editing.id) {
        const { error } = await supabase
          .from('destinations')
          .update({
            name: editing.name,
            name_en: editing.name_en,
            country: editing.country,
            country_code: editing.country_code,
            is_active: editing.is_active,
            display_order: editing.display_order,
          })
          .eq('id', editing.id);
        
        if (error) throw error;
        showNotification('success', 'Заслаа');
      }
      
      setEditing(null);
      setIsAdding(false);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Алдаа гарлаа');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Устгах уу?')) return;
    
    try {
      const { supabase } = await import('../../supabaseClient');
      const { error } = await supabase
        .from('destinations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      showNotification('success', 'Устгалаа');
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Алдаа гарлаа');
    }
  };

  const handleToggleActive = async (dest: Destination) => {
    try {
      const { supabase } = await import('../../supabaseClient');
      const { error } = await supabase
        .from('destinations')
        .update({ is_active: !dest.is_active })
        .eq('id', dest.id);
      
      if (error) throw error;
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Алдаа гарлаа');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Чиглэлүүд
        </h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Нэмэх
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Ачааллаж байна...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">#</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Нэр (Монгол)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Нэр (English)</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Улс</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Код</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Төлөв</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Үйлдэл</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {destinations.map((dest, idx) => (
                <tr key={dest.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm">{dest.name}</td>
                  <td className="px-4 py-3 text-sm">{dest.name_en || '-'}</td>
                  <td className="px-4 py-3 text-sm">{dest.country || '-'}</td>
                  <td className="px-4 py-3 text-sm">{dest.country_code || '-'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(dest)}
                      className={`px-2 py-1 text-xs rounded-full ${
                        dest.is_active 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {dest.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(dest)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(dest.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
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

      {(editing || isAdding) && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {isAdding ? 'Шинэ чиглэл' : 'Засах'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Нэр (Монгол) *
                </label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Жишээ: Солонгос"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Нэр (English)
                </label>
                <input
                  type="text"
                  value={editing.name_en}
                  onChange={(e) => setEditing({ ...editing, name_en: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="South Korea"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Улс
                  </label>
                  <input
                    type="text"
                    value={editing.country}
                    onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="South Korea"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Улсын код
                  </label>
                  <input
                    type="text"
                    value={editing.country_code}
                    onChange={(e) => setEditing({ ...editing, country_code: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="KR"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дэс
                </label>
                <input
                  type="number"
                  value={editing.display_order}
                  onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Идэвхтэй</span>
              </label>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setEditing(null); setIsAdding(false); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Цуцлах
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}