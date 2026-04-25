import React, { useState, useEffect } from 'react';
import { X, Search, User } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface UserSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string, userEmail: string) => void;
  currentUserId?: string;
}

interface UserOption {
  id: string;
  email: string;
  role?: string;
}

export default function UserSelectorModal({ isOpen, onClose, onSelect, currentUserId }: UserSelectorModalProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    
    const loadUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, role')
          .neq('id', currentUserId)
          .order('email');

        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [isOpen, currentUserId]);

  useEffect(() => {
    if (!search.trim()) return;
    
    const searchUsers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, email, role')
          .neq('id', currentUserId)
          .ilike('email', `%${search}%`)
          .order('email')
          .limit(20);

        if (error) throw error;
        setUsers(data || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, currentUserId]);

  if (!isOpen) return null;

  const handleSelect = (user: UserOption) => {
    onSelect(user.id, user.email);
  };

  const getRoleBadge = (role?: string) => {
    if (!role) return null;
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      manager: 'bg-blue-100 text-blue-700',
      provider: 'bg-green-100 text-green-700',
      agent: 'bg-yellow-100 text-yellow-700',
      subcontractor: 'bg-purple-100 text-purple-700',
    };
    return colors[role.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Шинэ чат</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Хэрэглэгч хайх..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Ачааллаж байна...</div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Хэрэглэгч олдсонгүй</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  {user.role && (
                    <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
