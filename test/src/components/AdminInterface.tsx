import { useState } from "react";
import {
  Users,
  MapPin,
  FileText,
  Trash2,
  Plus,
  Edit,
  Save,
} from "lucide-react";
import type { User as UserType, Tour, Order } from "../types/type";
import { supabase } from "../supabaseClient";
import Navbar from "./Navbar";
import RoleChanger from "../components/RoleChanger";

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
  setOrders,
  currentUser,
  onLogout,
}: AdminInterfaceProps) {
  const [selectedTab, setSelectedTab] = useState<"users" | "tours" | "orders">("orders");
  const [newTour, setNewTour] = useState({
    title: "",
    description: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
  });
  const [editingUser, setEditingUser] = useState<UserType | null>(null);

  // Prepare the tour data, converting departure_date to dates array format
  const handleAddTour = async () => {
    // Prepare the tour data - let's be more explicit about data types
    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      dates: newTour.departure_date ? [newTour.departure_date] : null,
      seats: newTour.seats ? parseInt(newTour.seats, 10) : null,
      hotels: newTour.hotels.trim() ? newTour.hotels.trim().split(',').map(h => h.trim()) : null,
      services: newTour.services.trim() ? newTour.services.trim().split(',').map(s => ({ name: s.trim(), price: 0 })) : null,
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("Sending tour data:", tourData); // Debug log

    const { data, error } = await supabase
      .from("tours")
      .insert(tourData)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error); // Debug log
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
        updated_at: new Date().toISOString(),
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role={currentUser.role} onLogout={onLogout} />

      <div>
        <RoleChanger users={users} setUsers={setUsers} currentUser={currentUser} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setSelectedTab("orders")}
              className={`pb-4 px-1 text-sm font-medium ${selectedTab === "orders"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Orders
            </button>
            <button
              onClick={() => setSelectedTab("tours")}
              className={`pb-4 px-1 text-sm font-medium ${selectedTab === "tours"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Tours
            </button>
            {currentUser.role === "superadmin" && (
              <button
                onClick={() => setSelectedTab("users")}
                className={`pb-4 px-1 text-sm font-medium ${selectedTab === "users"
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                Users
              </button>
            )}
          </nav>
        </div>

        {/* Orders Tab */}
        {selectedTab === "orders" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                All Bookings
              </h3>
            </div>
            <div className="overflow-x-auto">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No bookings available yet.</p>
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
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                Booking #{order.id}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(order.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {order.travel_choice}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {new Date(order.departureDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3 mr-1" />
                            {order.passengers.length} passengers
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.created_by}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tours Tab */}
        {selectedTab === "tours" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Add New Tour
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={newTour.title}
                    onChange={(e) =>
                      setNewTour({ ...newTour, title: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departure Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={newTour.departure_date}
                    onChange={(e) =>
                      setNewTour({ ...newTour, departure_date: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seats
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={newTour.seats}
                    onChange={(e) =>
                      setNewTour({ ...newTour, seats: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hotels (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Hotel A, Hotel B, Hotel C"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={newTour.hotels}
                    onChange={(e) =>
                      setNewTour({ ...newTour, hotels: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Services
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={newTour.services}
                    onChange={(e) =>
                      setNewTour({ ...newTour, services: e.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    value={newTour.description}
                    onChange={(e) =>
                      setNewTour({ ...newTour, description: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleAddTour}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Add Tour
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  All Tours
                </h3>
              </div>
              <div className="overflow-x-auto">
                {tours.length === 0 ? (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No tours available yet.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tour Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seats
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tours.map((tour) => (
                        <tr key={tour.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {tour.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {tour.description}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {tour.seats}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteTour(tour.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab (Superadmin only) */}
        {selectedTab === "users" && currentUser.role === "superadmin" && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Manage Users
              </h3>
            </div>
            <div className="overflow-x-auto">
              {users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No users available yet.</p>
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
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.role}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="text-blue-600 hover:text-blue-800 mr-4"
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
            {editingUser && (
              <div className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  Edit User: {editingUser.first_name} {editingUser.last_name}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={editingUser.role}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, role: e.target.value as UserType["role"] })
                      }
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="provider">Provider</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      value={editingUser.email}
                      onChange={(e) =>
                        setEditingUser({ ...editingUser, email: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <button
                    onClick={() => setEditingUser(null)}
                    className="px-6 py-2 border border-gray-300 rounded-lg mr-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateUser(editingUser)}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Save className="w-4 h-4 mr-2 inline" />
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminInterface;