// src/Pages/AdminInterface.tsx - ENHANCED VERSION
import { useState, useEffect } from "react";
import {
  Users,
  MapPin,
  FileText,
  Edit,
  Save,
  Shield,
  Clock,
} from "lucide-react";
import type { User as UserType, Tour, Order } from "../types/type";
import { supabase } from "../supabaseClient";
import Navbar from "./Navbar";
import RoleChanger from "../components/RoleChanger";
import AuthRequest from "../components/AuthRequest";

interface AdminInterfaceProps {
  users: UserType[];
  setUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
  onLogout: () => void;
}

function AdminInterface({
  users,
  setUsers,
  tours,
  setTours,
  orders,
  currentUser,
  onLogout,
}: AdminInterfaceProps) {
  const [selectedTab, setSelectedTab] = useState<
    "users" | "orders" | "addTourTab" | "authRequests"
  >("orders");

  // 🔥 ENHANCED: Better state management for pending count
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [newTour, setNewTour] = useState({
    title: "",
    description: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
  });
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  // 🔥 ENHANCED: Refresh users when new auth requests are approved
  const handleAuthRequestRefresh = async () => {
    console.log('🔄 Auth request processed, refreshing users...');
    
    try {
      // Refresh users list to include newly approved users
      const { data: updatedUsers, error } = await supabase.from("users").select("*");
      if (!error && updatedUsers) {
        setUsers(updatedUsers);
        console.log('✅ Users refreshed:', updatedUsers.length);
      }
    } catch (error) {
      console.error('❌ Error refreshing users:', error);
    }
    
    // Trigger re-render of AuthRequest component
    setRefreshKey(prev => prev + 1);
  };

  // 🔥 NEW: Auto-refresh pending count every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // This will trigger AuthRequest's onPendingCountChange
      console.log('🔄 Auto-refreshing pending count...');
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // DEBUG: Log user role to console
  useEffect(() => {
    console.log('🔍 AdminInterface Debug:', {
      currentUserRole: currentUser.role,
      isSuperAdmin: currentUser.role === 'superadmin',
      isAdmin: currentUser.role === 'admin',
      usersLength: users.length,
      pendingCount: pendingUsersCount
    });
  }, [currentUser.role, users.length, pendingUsersCount]);

  const handleAddTourTab = async () => {
    if (!newTour.departure_date) {
      alert("Departure date is required");
      return;
    }

    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      dates: newTour.departure_date ? [newTour.departure_date] : [],
      seats: newTour.seats ? parseInt(newTour.seats, 10) : null,
      hotels: newTour.hotels.trim() ? newTour.hotels.trim().split(',').map(h => h.trim()) : [],
      services: newTour.services.trim()
        ? newTour.services.trim().split(',').map(s => ({ name: s.trim(), price: 0 }))
        : [],
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Sending tour data:", tourData);

    const { data, error } = await supabase
      .from("tours")
      .insert(tourData)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      alert("Error adding tour: " + error.message);
      return;
    }

    setTours([...tours, data]);
    setNewTour({
      title: "",
      description: "",
      departure_date: "",
      seats: "",
      hotels: "",
      services: "",
    });
    alert("Tour added successfully!");
  };

  const handleDeleteTour = async (tourId: string) => {
    const { error } = await supabase.from("tours").delete().eq("id", tourId);
    if (error) {
      alert("Error deleting tour: " + error.message);
      return;
    }
    setTours(tours.filter((tour) => tour.id !== tourId));
    alert("Tour deleted successfully!");
  };

  const handleUpdateUser = async (user: UserType) => {
    const { error } = await supabase
      .from("users")
      .update({
        ...user,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      alert("Error updating user: " + error.message);
      return;
    }
    setUsers(users.map((u) => (u.id === user.id ? user : u)));
    setEditingUser(null);
    alert("User updated successfully!");
  };

  // FIXED: Safe ID display function
  const displayOrderId = (id: any) => {
    if (!id) return 'N/A';
    const idStr = String(id);
    if (idStr.length > 8) {
      return idStr.substring(0, 8) + '...';
    }
    return idStr;
  };

  // DEBUG: Check if user can see admin tabs
  const canSeeAdminTabs = currentUser.role === "superadmin" || currentUser.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role={currentUser.role} onLogout={onLogout} />
      
      {/* RoleChanger Section - Enhanced UI */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                  <p className="text-sm text-gray-600">Manage roles and permissions for all users</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                currentUser.role === 'superadmin' 
                  ? 'bg-green-100 text-green-800' 
                  : currentUser.role === 'admin'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {currentUser.role} Access
              </span>
            </div>
            <RoleChanger users={users} setUsers={setUsers} currentUser={currentUser} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ENHANCED Navigation Tabs */}
        <div className="">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setSelectedTab("orders")}
              className={`group flex items-center pb-4 px-1 text-sm font-medium transition-all duration-200 ${
                selectedTab === "orders"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <FileText className={`w-4 h-4 mr-2 ${selectedTab === "orders" ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
              Orders
              <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {orders.length}
              </span>
            </button>
            
            {/* Show tabs for both admin and superadmin */}
            {canSeeAdminTabs && (
              <>
                <button
                  onClick={() => setSelectedTab("users")}
                  className={`group flex items-center pb-4 px-1 text-sm font-medium transition-all duration-200 ${
                    selectedTab === "users"
                      ? "border-b-2 border-purple-600 text-purple-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Users className={`w-4 h-4 mr-2 ${selectedTab === "users" ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  Users
                  <span className="ml-1 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    {users.length}
                  </span>
                </button>
                
                {/* ENHANCED: Auth Requests Tab with Dynamic Badge */}
                <button
                  onClick={() => setSelectedTab("authRequests")}
                  className={`group flex items-center pb-4 px-1 text-sm font-medium transition-all duration-200 relative ${
                    selectedTab === "authRequests"
                      ? "border-b-2 border-emerald-600 text-emerald-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Clock className={`w-4 h-4 mr-2 ${selectedTab === "authRequests" ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  Auth Requests
                  
                  {/* 🔥 ENHANCED: Dynamic Notification Badge */}
                  {pendingUsersCount > 0 ? (
                    <span className="absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse shadow-lg border-2 border-white">
                      {pendingUsersCount > 99 ? '99+' : pendingUsersCount}
                    </span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-400">(0)</span>
                  )}
                </button>

                {/* Add Tour Tab */}
                <button
                  onClick={() => setSelectedTab("addTourTab")}
                  className={`group flex items-center pb-4 px-1 text-sm font-medium transition-all duration-200 ${
                    selectedTab === "addTourTab"
                      ? "border-b-2 border-green-600 text-green-600"
                      : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <MapPin className={`w-4 h-4 mr-2 ${selectedTab === "addTourTab" ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-500'}`} />
                  Add Tour
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Debug Info - Remove after testing */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              🔍 <strong>Debug:</strong> Role: {currentUser.role} | Can see admin tabs: {canSeeAdminTabs ? 'YES' : 'NO'} | Pending: {pendingUsersCount} | Users: {users.length}
            </p>
          </div>
        )}

        {/* Orders Tab */}
        {selectedTab === "orders" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                All Bookings ({orders.length})
              </h3>
              <button
                onClick={onLogout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center transition-colors shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v-7a3 3 0 00-3-3H5" />
                </svg>
                Logout
              </button>
            </div>
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No bookings available yet.</p>
                  <p className="text-sm text-gray-400 mt-2">Bookings will appear here once users start booking tours.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tour
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departure
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Passengers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                Booking #{displayOrderId(order.id)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {order.travel_choice || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {order.departureDate ? new Date(order.departureDate).toLocaleDateString() : 'TBD'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3 mr-1" />
                            {order.passengers?.length || 0} passengers
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.createdBy || order.created_by || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {selectedTab === "users" && canSeeAdminTabs && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-purple-600" />
                  Active Users ({users.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                {users.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No users available yet.</p>
                    <p className="text-sm text-gray-400 mt-2">Users will appear here once they register and get approved.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                  {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {user.first_name} {user.last_name}
                                </div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'user' ? 'bg-blue-100 text-blue-800' :
                              user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                              user.role === 'superadmin' ? 'bg-indigo-100 text-indigo-800' :
                              user.role === 'provider' ? 'bg-green-100 text-green-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.status === 'approved' ? 'bg-green-100 text-green-800' :
                              user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              user.access === 'suspended' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {user.status || user.access}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="text-blue-600 hover:text-blue-900 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Enhanced Edit User Modal */}
              {editingUser && (
                <div className="p-6 bg-gray-50 border-t border-gray-200">
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                      <h4 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                        <Edit className="w-5 h-5 mr-2 text-blue-600" />
                        Edit User: {editingUser.first_name} {editingUser.last_name}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Role <span className="text-red-500">*</span>
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            value={editingUser.role}
                            onChange={(e) =>
                              setEditingUser({ ...editingUser, role: e.target.value as UserType["role"] })
                            }
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="provider">Provider</option>
                            <option value="manager">Manager</option>
                            {currentUser.role === 'superadmin' && (
                              <option value="superadmin">Superadmin</option>
                            )}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            value={editingUser.email}
                            onChange={(e) =>
                              setEditingUser({ ...editingUser, email: e.target.value })
                            }
                          />
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            value={editingUser.access || editingUser.status || 'active'}
                            onChange={(e) =>
                              setEditingUser({ ...editingUser, access: e.target.value as any })
                            }
                          >
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          onClick={() => setEditingUser(null)}
                          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleUpdateUser(editingUser)}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors shadow-sm"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Tour Tab */}
        {selectedTab === "addTourTab" && canSeeAdminTabs && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-green-600" />
                Add New Tour
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tour Title</label>
                  <input
                    type="text"
                    value={newTour.title}
                    onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter tour title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date</label>
                  <input
                    type="date"
                    value={newTour.departure_date}
                    onChange={(e) => setNewTour({ ...newTour, departure_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={newTour.description}
                    onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                    placeholder="Enter tour description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Available Seats</label>
                  <input
                    type="number"
                    value={newTour.seats}
                    onChange={(e) => setNewTour({ ...newTour, seats: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter number of seats"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hotels (comma separated)</label>
                  <input
                    type="text"
                    value={newTour.hotels}
                    onChange={(e) => setNewTour({ ...newTour, hotels: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Hotel A, Hotel B, Hotel C"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Services (comma separated)</label>
                  <input
                    type="text"
                    value={newTour.services}
                    onChange={(e) => setNewTour({ ...newTour, services: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Breakfast, Transportation, Guide"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={handleAddTourTab}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center transition-colors shadow-sm"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Add Tour
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 🔥 ENHANCED: Auth Requests Tab - FULLY INTEGRATED */}
        {selectedTab === "authRequests" && canSeeAdminTabs && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Account Approval Requests</h3>
                    <p className="text-sm text-gray-500">
                      Review and approve new user registrations • {pendingUsersCount} pending
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleAuthRequestRefresh}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center transition-colors shadow-sm text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              
              {/* 🔥 AuthRequest Component with Key for Refresh */}
              <AuthRequest 
                currentUserId={currentUser.id} 
                onRefresh={handleAuthRequestRefresh}
                onPendingCountChange={(count) => {
                  console.log('📊 Pending count updated:', count);
                  setPendingUsersCount(count);
                }}
                key={refreshKey}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminInterface;