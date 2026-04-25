import React, { useState } from 'react';
import {
  Settings,
  Users,
  Plane,
  CreditCard,
  Calendar,
  List,
  Car,
  DollarSign,
  Building,
  Save,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react';
import type { User as UserType } from '../../types/type';
import AppShell from '../design/AppShell';
import StatusBadge from '../design/StatusBadge';
import Modal from '../design/Modal';

interface AdminConfigProps {
  currentUser: UserType;
  onLogout: () => void;
}

type ConfigTab = 'users' | 'tours' | 'pricing' | 'system';

interface ConfigItem {
  id: string;
  name: string;
  value: string;
  type: string;
  status: 'active' | 'inactive';
}

export default function AdminConfigPanel({ currentUser, onLogout }: AdminConfigProps) {
  const [activeTab, setActiveTab] = useState<ConfigTab>('users');
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  const tabs = [
    { id: 'users', label: 'Users', icon: <Users size={18} /> },
    { id: 'tours', label: 'Tours', icon: <Plane size={18} /> },
    { id: 'pricing', label: 'Pricing', icon: <DollarSign size={18} /> },
    { id: 'system', label: 'System', icon: <Settings size={18} /> },
  ];

  const configItems: ConfigItem[] = [
    { id: '1', name: 'User Registration', value: 'enabled', type: 'toggle', status: 'active' },
    { id: '2', name: 'Email Notifications', value: 'enabled', type: 'toggle', status: 'active' },
    { id: '3', name: 'Payment Gateway', value: 'qpay', type: 'select', status: 'active' },
    { id: '4', name: 'Default Currency', value: 'MNT', type: 'select', status: 'active' },
    { id: '5', name: 'Auto Approve Agents', value: 'disabled', type: 'toggle', status: 'inactive' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">User Management Settings</h3>
              <button className="btn btn--primary btn--sm">
                <Plus size={14} />
                Add Setting
              </button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Value</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {configItems.slice(0, 3).map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td>{item.value}</td>
                      <td className="text-gray-500">{item.type}</td>
                      <td>
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setShowModal(true);
                            }}
                            className="btn btn--ghost btn--sm"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn--ghost btn--sm text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'tours':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Tour Configuration</h3>
              <button className="btn btn--primary btn--sm">
                <Plus size={14} />
                Add Setting
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Plane size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">Default Tour Status</div>
                    <div className="text-sm text-gray-500">New tours created as</div>
                  </div>
                </div>
                <select className="select">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Calendar size={18} className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">Booking Window</div>
                    <div className="text-sm text-gray-500">Days before departure</div>
                  </div>
                </div>
                <select className="select">
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Users size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium">Min. Passengers</div>
                    <div className="text-sm text-gray-500">Minimum group size</div>
                  </div>
                </div>
                <select className="select">
                  <option value="1">1 person</option>
                  <option value="2">2 people</option>
                  <option value="5">5 people</option>
                </select>
              </div>

              <div className="card p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <List size={18} className="text-yellow-600" />
                  </div>
                  <div>
                    <div className="font-medium">Default Itinerary</div>
                    <div className="text-sm text-gray-500">Template for new tours</div>
                  </div>
                </div>
                <select className="select">
                  <option value="standard">Standard 5-day</option>
                  <option value="extended">Extended 7-day</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'pricing':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Pricing Configuration</h3>
              <button className="btn btn--primary btn--sm">
                <Plus size={14} />
                Add Price Rule
              </button>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Price Rule</th>
                    <th>Value</th>
                    <th>Applies To</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-medium">Child Discount</td>
                    <td>20%</td>
                    <td className="text-gray-500">Children under 12</td>
                    <td>
                      <StatusBadge status="active" size="sm" />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn--ghost btn--sm">
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">Infant Free</td>
                    <td>100%</td>
                    <td className="text-gray-500">Infants under 2</td>
                    <td>
                      <StatusBadge status="active" size="sm" />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn--ghost btn--sm">
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium">Group Discount</td>
                    <td>10%</td>
                    <td className="text-gray-500">Groups of 10+</td>
                    <td>
                      <StatusBadge status="active" size="sm" />
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn btn--ghost btn--sm">
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">System Settings</h3>
              <button className="btn btn--primary btn--sm">
                <Save size={14} />
                Save Changes
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-4">
                <div className="font-medium mb-3">API Configuration</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">API Base URL</label>
                    <input
                      type="text"
                      className="input mt-1"
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">API Key</label>
                    <input
                      type="password"
                      className="input mt-1"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <div className="font-medium mb-3">Email Settings</div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-500">SMTP Host</label>
                    <input
                      type="text"
                      className="input mt-1"
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">From Email</label>
                    <input
                      type="email"
                      className="input mt-1"
                      placeholder="noreply@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <div className="font-medium mb-3">Feature Flags</div>
                <div className="space-y-2">
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Enable B2B Mode</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Enable Global API Sync</span>
                    <input type="checkbox" className="toggle" />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-sm">Enable Chatbot</span>
                    <input type="checkbox" className="toggle" defaultChecked />
                  </label>
                </div>
              </div>

              <div className="card p-4">
                <div className="font-medium mb-3">Maintenance</div>
                <div className="space-y-3">
                  <button className="btn btn--secondary w-full">
                    Clear Cache
                  </button>
                  <button className="btn btn--secondary w-full">
                    Rebuild Indexes
                  </button>
                  <button className="btn btn--danger w-full">
                    Reset Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <AppShell currentUser={currentUser} onLogout={onLogout}>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Configure system and application settings
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ConfigTab)}
            className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
          >
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="card-body">{renderTabContent()}</div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingItem(null);
        }}
        title="Edit Setting"
        footer={
          <>
            <button
              className="btn btn--ghost"
              onClick={() => {
                setShowModal(false);
                setEditingItem(null);
              }}
            >
              Cancel
            </button>
            <button className="btn btn--primary">Save Changes</button>
          </>
        }
      >
        {editingItem && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Setting Name</label>
              <input
                type="text"
                className="input mt-1"
                defaultValue={editingItem.name}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Value</label>
              <input
                type="text"
                className="input mt-1"
                defaultValue={editingItem.value}
              />
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}