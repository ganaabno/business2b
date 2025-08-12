import { useState } from "react";
import {
  User as UserIcon,
  MapPin,
  FileText,
  Trash2,
  Plus,
  Edit,
  Eye,
  Save,
} from "lucide-react";
import type { User as UserType, Tour, Order } from "../types/type";

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
  const [newUser, setNewUser] = useState({
    id: "",
    userId: "",
    username: "",
    password: "",
    role: "user" as UserType["role"],
    company: "",
    access: "active" as UserType["access"],
    createdBy: currentUser.username,
    createdAt: new Date().toISOString(),
    lastLogin: null as string | null,
  });
  const [newTour, setNewTour] = useState({
    id: "",
    title: "",
    description: "",
    name: "",
    dates: [] as string[],
    seats: 0,
    hotels: [] as string[],
    services: [] as { name: string; price: number }[],
    createdBy: currentUser.username,
    createdAt: new Date().toISOString(),
  });
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const addUser = () => {
    if (!newUser.username || !newUser.password) {
      alert("Username and password are required.");
      return;
    }
    const id = `user-${Date.now()}`;
    setUsers([
      ...users,
      { ...newUser, id, userId: id, createdBy: currentUser.username, createdAt: new Date().toISOString() },
    ]);
    setNewUser({
      id: "",
      userId: "",
      username: "",
      password: "",
      role: "user",
      company: "",
      access: "active",
      createdBy: currentUser.username,
      createdAt: new Date().toISOString(),
      lastLogin: null,
    });
    alert("User added successfully!");
  };

  const updateUser = () => {
    if (!editingUser) return;
    setUsers(
      users.map((u) =>
        u.id === editingUser.id ? { ...editingUser, createdBy: currentUser.username } : u
      )
    );
    setEditingUser(null);
    alert("User updated successfully!");
  };

  const deleteUser = (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.id !== id));
      alert("User deleted successfully!");
    }
  };

  const addTour = () => {
    if (!newTour.name || !newTour.title || !newTour.description) {
      alert("Tour name, title, and description are required.");
      return;
    }
    const id = `tour-${Date.now()}`;
    setTours([...tours, { ...newTour, id }]);
    setNewTour({
      id: "",
      title: "",
      description: "",
      name: "",
      dates: [],
      seats: 0,
      hotels: [],
      services: [],
      createdBy: currentUser.username,
      createdAt: new Date().toISOString(),
    });
    alert("Tour added successfully!");
  };

  const updateTour = () => {
    if (!editingTour) return;
    setTours(tours.map((t) => (t.id === editingTour.id ? editingTour : t)));
    setEditingTour(null);
    alert("Tour updated successfully!");
  };

  const deleteTour = (id: string) => {
    if (confirm("Are you sure you want to delete this tour?")) {
      setTours(tours.filter((t) => t.id !== id));
      alert("Tour deleted successfully!");
    }
  };

  const updateOrderStatus = (orderId: string, status: string) => {
    setOrders(
      orders.map((o) =>
        o.id === orderId ? { ...o, status, createdBy: currentUser.username } : o
      )
    );
    alert("Order status updated!");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {currentUser.role === "superadmin" ? "Super Admin" : "Admin"} Dashboard
            </h1>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser.role === "superadmin" && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage Users</h2>
            <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Username"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  value={editingUser ? editingUser.username : newUser.username}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({ ...editingUser, username: e.target.value })
                      : setNewUser({ ...newUser, username: e.target.value })
                  }
                />
                <input
                  type="password"
                  placeholder="Password"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  value={editingUser ? editingUser.password : newUser.password}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({ ...editingUser, password: e.target.value })
                      : setNewUser({ ...newUser, password: e.target.value })
                  }
                />
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  value={editingUser ? editingUser.role : newUser.role}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({ ...editingUser, role: e.target.value as UserType["role"] })
                      : setNewUser({ ...newUser, role: e.target.value as UserType["role"] })
                  }
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="provider">Provider</option>
                  <option value="superadmin">Super Admin</option>
                </select>
                <input
                  type="text"
                  placeholder="Company (optional)"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  value={editingUser ? editingUser.company : newUser.company}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({ ...editingUser, company: e.target.value })
                      : setNewUser({ ...newUser, company: e.target.value })
                  }
                />
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                  value={editingUser ? editingUser.access : newUser.access}
                  onChange={(e) =>
                    editingUser
                      ? setEditingUser({ ...editingUser, access: e.target.value as UserType["access"] })
                      : setNewUser({ ...newUser, access: e.target.value as UserType["access"] })
                  }
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="mt-4">
                <button
                  onClick={editingUser ? updateUser : addUser}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingUser ? "Update User" : "Add User"}
                </button>
                {editingUser && (
                  <button
                    onClick={() => setEditingUser(null)}
                    className="ml-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Users</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.role}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.company || "N/A"}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.access}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-blue-600 hover:text-blue-800 mr-2"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage Tours</h2>
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">
              {editingTour ? "Edit Tour" : "Add New Tour"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Tour Name"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={editingTour ? editingTour.name : newTour.name}
                onChange={(e) =>
                  editingTour
                    ? setEditingTour({ ...editingTour, name: e.target.value })
                    : setNewTour({ ...newTour, name: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Tour Title"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={editingTour ? editingTour.title : newTour.title}
                onChange={(e) =>
                  editingTour
                    ? setEditingTour({ ...editingTour, title: e.target.value })
                    : setNewTour({ ...newTour, title: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Description"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={editingTour ? editingTour.description : newTour.description}
                onChange={(e) =>
                  editingTour
                    ? setEditingTour({ ...editingTour, description: e.target.value })
                    : setNewTour({ ...newTour, description: e.target.value })
                }
              />
              <input
                type="number"
                placeholder="Seats"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={editingTour ? editingTour.seats : newTour.seats}
                onChange={(e) =>
                  editingTour
                    ? setEditingTour({ ...editingTour, seats: parseInt(e.target.value) || 0 })
                    : setNewTour({ ...newTour, seats: parseInt(e.target.value) || 0 })
                }
              />
              <input
                type="text"
                placeholder="Dates (comma-separated)"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={editingTour ? editingTour.dates.join(",") : newTour.dates.join(",")}
                onChange={(e) =>
                  editingTour
                    ? setEditingTour({ ...editingTour, dates: e.target.value.split(",").map((d) => d.trim()) })
                    : setNewTour({ ...newTour, dates: e.target.value.split(",").map((d) => d.trim()) })
                }
              />
              <input
                type="text"
                placeholder="Hotels (comma-separated)"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={editingTour ? editingTour.hotels.join(",") : newTour.hotels.join(",")}
                onChange={(e) =>
                  editingTour
                    ? setEditingTour({ ...editingTour, hotels: e.target.value.split(",").map((h) => h.trim()) })
                    : setNewTour({ ...newTour, hotels: e.target.value.split(",").map((h) => h.trim()) })
                }
              />
              <input
                type="text"
                placeholder="Services (name:price, comma-separated)"
                className="px-3 py-2 border border-gray-300 rounded-lg"
                value={
                  editingTour
                    ? editingTour.services.map((s) => `${s.name}:${s.price}`).join(",")
                    : newTour.services.map((s) => `${s.name}:${s.price}`).join(",")
                }
                onChange={(e) => {
                  const services = e.target.value.split(",").map((s) => {
                    const [name, price] = s.split(":").map((v) => v.trim());
                    return { name, price: parseInt(price) || 0 };
                  });
                  editingTour
                    ? setEditingTour({ ...editingTour, services })
                    : setNewTour({ ...newTour, services });
                }}
              />
            </div>
            <div className="mt-4">
              <button
                onClick={editingTour ? updateTour : addTour}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingTour ? "Update Tour" : "Add Tour"}
              </button>
              {editingTour && (
                <button
                  onClick={() => setEditingTour(null)}
                  className="ml-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Tours</h3>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seats</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tours.map((tour) => (
                  <tr key={tour.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{tour.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{tour.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{tour.seats}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setEditingTour(tour)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTour(tour.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Manage Orders</h2>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Orders</h3>
            {selectedOrder ? (
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Order Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p><strong>Tour:</strong> {selectedOrder.tour}</p>
                    <p><strong>Departure Date:</strong> {selectedOrder.departureDate}</p>
                    <p><strong>Status:</strong> {selectedOrder.status}</p>
                    <p><strong>Created By:</strong> {selectedOrder.createdBy}</p>
                  </div>
                  <div>
                    <p><strong>Passengers:</strong> {selectedOrder.passengers.length}</p>
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <h5 className="text-sm font-medium text-gray-900 mb-2">Passengers</h5>
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nationality</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedOrder.passengers.map((passenger) => (
                      <tr key={passenger.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{passenger.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{passenger.nationality}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{passenger.roomType}</td>
                        <td className="px-6 py-4 whitespace-nowrap">${passenger.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                >
                  Back to Orders
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tour</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Departure</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Passengers</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{order.tour}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{order.departureDate}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{order.passengers.length}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{order.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
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
    </div>
  );
}

export default AdminInterface;