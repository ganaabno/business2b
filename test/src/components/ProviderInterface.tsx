import { useState } from "react";
import Navbar from "./Navbar";
import type { Tour, User } from "../types/type";
import "bootstrap/dist/css/bootstrap.min.css";

interface ProviderInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  currentUser: User;
  onLogout: () => void;
}

function ProviderInterface({ tours, setTours, currentUser, onLogout }: ProviderInterfaceProps) {
  const [newTour, setNewTour] = useState<Tour>({
    name: "",
    dates: [""],
    seats: 0,
    hotels: [""],
    services: [{ name: "", price: 0 }],
    createdBy: "",
    createdAt: ""
  });


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
        <h2>Provider Dashboard</h2>
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
            {tours
              .filter((tour) => tour.createdBy === currentUser.username || currentUser.role === "superadmin" || currentUser.role === "admin")
              .map((tour) => (
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
      </div>
    </div>
  );
}

export default ProviderInterface;