import { useState } from "react";
import Navbar from "./Navbar";
import type { User, Tour, Order } from "../types/type";
import "bootstrap/dist/css/bootstrap.min.css";

interface AdminInterfaceProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: User;
  onLogout: () => void;
}

function AdminInterface({ users, setUsers, tours, setTours, orders, setOrders, currentUser, onLogout }: AdminInterfaceProps) {
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" as User["role"], company: "" });
  const [newTour, setNewTour] = useState<Tour>({
    name: "",
    dates: [""],
    seats: 0,
    hotels: [""],
    services: [{ name: "", price: 0 }],
    createdBy: "",
    createdAt: ""
  });


  const addUser = () => {
    if (!newUser.username || !newUser.password) {
      alert("Username and password are required.");
      return;
    }
    setUsers([
      ...users,
      {
        ...newUser,
        access: "active",
        createdBy: currentUser.username,
        createdAt: new Date().toISOString(),
        lastLogin: null,
      },
    ]);
    setNewUser({ username: "", password: "", role: "user", company: "" });
    alert("User added successfully.");
  };

  const toggleUserAccess = (username: string) => {
    setUsers(
      users.map((u) =>
        u.username === username ? { ...u, access: u.access === "active" ? "suspended" : "active" } : u
      )
    );
    alert(`User ${username} access toggled.`);
  };

  const addTour = () => {
    if (!newTour.name || newTour.seats <= 0 || newTour.dates[0] === "" || newTour.hotels[0] === "") {
      alert("Tour name, seats, at least one date, and one hotel are required.");
      return;
    }
    setTours([
      ...tours,
      {
        ...newTour,
        createdBy: currentUser.username,
        createdAt: new Date().toISOString(),
      },
    ]);
    setNewTour({ name: "", dates: [""], seats: 0, hotels: [""], services: [{ name: "", price: 0 }], createdBy: "", createdAt: "" });
    alert("Tour added successfully.");
  };

  return (
    <div>
      <Navbar role={currentUser.role} onLogout={onLogout} />
      <div className="container mt-4">
        <h2>{currentUser.role === "superadmin" ? "Super Admin" : "Admin"} Dashboard</h2>
        <h3>Manage Users</h3>
        <div className="mb-3">
          <input
            type="text"
            className="form-control d-inline-block me-2"
            style={{ width: "200px" }}
            placeholder="Username"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
          />
          <input
            type="password"
            className="form-control d-inline-block me-2"
            style={{ width: "200px" }}
            placeholder="Password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
          />
          <select
            className="form-select d-inline-block me-2"
            style={{ width: "150px" }}
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value as User["role"] })}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
            <option value="provider">Provider</option>
            {currentUser.role === "superadmin" && <option value="superadmin">Super Admin</option>}
          </select>
          <input
            type="text"
            className="form-control d-inline-block me-2"
            style={{ width: "200px" }}
            placeholder="Company (optional)"
            value={newUser.company}
            onChange={(e) => setNewUser({ ...newUser, company: e.target.value })}
          />
          <button className="btn btn-primary" onClick={addUser}>
            Add User
          </button>
        </div>
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Company</th>
              <th>Access</th>
              <th>Created By</th>
              <th>Created At</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.username}>
                <td>{user.username}</td>
                <td>{user.role}</td>
                <td>{user.company || "-"}</td>
                <td>{user.access}</td>
                <td>{user.createdBy}</td>
                <td>{new Date(user.createdAt).toLocaleString()}</td>
                <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "-"}</td>
                <td>
                  <button
                    className={`btn btn-${user.access === "active" ? "danger" : "success"}`}
                    onClick={() => toggleUserAccess(user.username)}
                  >
                    {user.access === "active" ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Manage Tours</h3>
        <div className="mb-3">
          <input
            type="text"
            className="form-control d-inline-block me-2"
            style={{ width: "200px" }}
            placeholder="Tour Name"
            value={newTour.name}
            onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
          />
          <input
            type="number"
            className="form-control d-inline-block me-2"
            style={{ width: "100px" }}
            placeholder="Seats"
            value={newTour.seats || ""}
            onChange={(e) => setNewTour({ ...newTour, seats: parseInt(e.target.value) || 0 })}
          />
          <input
            type="date"
            className="form-control d-inline-block me-2"
            style={{ width: "150px" }}
            value={newTour.dates[0]}
            onChange={(e) => setNewTour({ ...newTour, dates: [e.target.value] })}
          />
          <input
            type="text"
            className="form-control d-inline-block me-2"
            style={{ width: "200px" }}
            placeholder="Hotel"
            value={newTour.hotels[0]}
            onChange={(e) => setNewTour({ ...newTour, hotels: [e.target.value] })}
          />
          <button className="btn btn-primary" onClick={addTour}>
            Add Tour
          </button>
        </div>
        <table className="table table-striped table-bordered">
          <thead>
            <tr>
              <th>Name</th>
              <th>Dates</th>
              <th>Seats</th>
              <th>Hotels</th>
              <th>Services</th>
              <th>Created By</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {tours.map((tour) => (
              <tr key={tour.name}>
                <td>{tour.name}</td>
                <td>{tour.dates.join(", ")}</td>
                <td>{tour.seats}</td>
                <td>{tour.hotels.join(", ")}</td>
                <td>{tour.services.map((s) => `${s.name} ($${s.price})`).join(", ")}</td>
                <td>{tour.createdBy}</td>
                <td>{new Date(tour.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Orders</h3>
        {orders.length === 0 ? (
          <p>No orders available.</p>
        ) : (
          <table className="table table-striped table-bordered">
            <thead>
              <tr>
                <th>Tour</th>
                <th>Departure Date</th>
                <th>Passengers</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={index}>
                  <td>{order.tour}</td>
                  <td>{order.departureDate}</td>
                  <td>{order.passengers.length}</td>
                  <td>{order.createdBy}</td>
                  <td>{new Date(order.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminInterface;