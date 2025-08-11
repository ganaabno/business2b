import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import type { Tour, Order, Passenger, User } from "../types/type";
import "bootstrap/dist/css/bootstrap.min.css";

interface UserInterfaceProps {
  tours: Tour[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: User;
  onLogout: () => void;
}

function UserInterface({ tours, orders, setOrders, currentUser, onLogout }: UserInterfaceProps) {
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const navigate = useNavigate();

  const countries = [
    "Mongolia",
    "Russia",
    "China",
    "Afghanistan",
    "Albania",
    // Add other countries as needed
    "Zimbabwe",
  ].filter((c) => !["Mongolia", "Russia", "China"].includes(c)).sort();

  const updateDepartureDates = (tourName: string) => {
    const tour = tours.find((t) => t.name === tourName);
    setDepartureDate("");
    if (tour) {
      const select = document.getElementById("departureDate") as HTMLSelectElement;
      select.innerHTML = '<option value="">Select Date</option>';
      tour.dates.forEach((date) => {
        const option = document.createElement("option");
        option.value = date;
        option.text = date;
        select.appendChild(option);
      });
    }
  };

  const addPassenger = () => {
    setPassengers([
      ...passengers,
      {
        roomAllocation: "",
        serialNo: "",
        lastName: "",
        firstName: "",
        dateOfBirth: "",
        age: 0,
        gender: "",
        passportNumber: "",
        passportExpiry: "",
        nationality: "",
        roomType: "",
        hotel: "",
        additionalServices: [],
        price: 0,
        email: "",
        phone: "",
      },
    ]);
  };

  const updatePassenger = (index: number, field: keyof Passenger, value: any) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    if (field === "dateOfBirth" && value) {
      const dob = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      updatedPassengers[index].age = age;
    }
    if (field === "additionalServices") {
      const tour = tours.find((t) => t.name === selectedTour);
      if (tour) {
        const price = (value as string[])
          .reduce((sum, service) => {
            const svc = tour.services.find((s) => s.name === service);
            return sum + (svc ? svc.price : 0);
          }, 0);
        updatedPassengers[index].price = price;
      }
    }
    setPassengers(updatedPassengers);
  };

  const removePassenger = (index: number) => {
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const saveOrder = () => {
    if (!selectedTour || !departureDate || passengers.length === 0) {
      alert("Please select a tour, departure date, and add at least one passenger.");
      return;
    }
    const newOrder: Order = {
      tour: selectedTour,
      departureDate,
      passengers,
      createdBy: currentUser.username,
      createdAt: new Date().toISOString(),
    };
    setOrders([...orders, newOrder]);
    alert("Order saved successfully!");
    setPassengers([]);
    setSelectedTour("");
    setDepartureDate("");
  };

  const downloadCSV = () => {
    const headers = [
      "Room Allocation",
      "Serial No",
      "Last Name",
      "First Name",
      "Date of Birth",
      "Age",
      "Gender",
      "Passport Number",
      "Passport Expiry",
      "Nationality",
      "Room Type",
      "Hotel",
      "Additional Services",
      "Price",
      "Email",
      "Phone",
    ];
    const rows = passengers.map((p) =>
      [
        p.roomAllocation,
        p.serialNo,
        p.lastName,
        p.firstName,
        p.dateOfBirth,
        p.age,
        p.gender,
        p.passportNumber,
        p.passportExpiry,
        p.nationality,
        p.roomType,
        p.hotel,
        p.additionalServices.join(","),
        p.price,
        p.email,
        p.phone,
      ].map((v) => `"${v}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order_${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const select = document.getElementById("tour") as HTMLSelectElement;
    select.innerHTML = '<option value="">Select Tour</option>';
    tours.forEach((tour) => {
      const option = document.createElement("option");
      option.value = tour.name;
      option.text = tour.name;
      select.appendChild(option);
    });
  }, [tours]);

  return (
    <div>
      <Navbar role={currentUser.role} onLogout={onLogout} />
      <div className="container mt-4">
        <h2>{currentUser.role === "user" ? "Book a Tour" : "View Tour Bookings"}</h2>
        <p>Please enter information in English or Latin characters only.</p>
        {currentUser.role === "user" ? (
          <form id="orderForm">
            <div className="mb-3">
              <label htmlFor="tour" className="form-label">
                Tour
              </label>
              <select
                className="form-select"
                id="tour"
                value={selectedTour}
                onChange={(e) => {
                  setSelectedTour(e.target.value);
                  updateDepartureDates(e.target.value);
                }}
              >
                <option value="">Select Tour</option>
              </select>
            </div>
            <div className="mb-3">
              <label htmlFor="departureDate" className="form-label">
                Departure Date
              </label>
              <select
                className="form-select"
                id="departureDate"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
              >
                <option value="">Select Date</option>
              </select>
            </div>
            <div className="table-responsive">
              <table className="table table-striped table-bordered" id="orderTable">
                <thead>
                  <tr>
                    <th>Room Allocation</th>
                    <th>Serial No</th>
                    <th>Last Name</th>
                    <th>First Name</th>
                    <th>Date of Birth</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Passport Number</th>
                    <th>Passport Expiry</th>
                    <th>Nationality</th>
                    <th>Room Type</th>
                    <th>Hotel</th>
                    <th>Additional Services</th>
                    <th>Price</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Passport Upload</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="orderTableBody">
                  {passengers.map((passenger, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={passenger.roomAllocation}
                          onChange={(e) =>
                            updatePassenger(index, "roomAllocation", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={passenger.serialNo}
                          onChange={(e) =>
                            updatePassenger(index, "serialNo", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={passenger.lastName}
                          onChange={(e) =>
                            updatePassenger(index, "lastName", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={passenger.firstName}
                          onChange={(e) =>
                            updatePassenger(index, "firstName", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-control"
                          value={passenger.dateOfBirth}
                          onChange={(e) =>
                            updatePassenger(index, "dateOfBirth", e.target.value)
                          }
                        />
                      </td>
                      <td>{passenger.age}</td>
                      <td>
                        <select
                          className="form-select"
                          value={passenger.gender}
                          onChange={(e) =>
                            updatePassenger(index, "gender", e.target.value)
                          }
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={passenger.passportNumber}
                          onChange={(e) =>
                            updatePassenger(index, "passportNumber", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          className="form-control"
                          value={passenger.passportExpiry}
                          onChange={(e) =>
                            updatePassenger(index, "passportExpiry", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={passenger.nationality}
                          onChange={(e) =>
                            updatePassenger(index, "nationality", e.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {countries.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={passenger.roomType}
                          onChange={(e) =>
                            updatePassenger(index, "roomType", e.target.value)
                          }
                        >
                          <option value="">Select</option>
                          <option value="Single">Single</option>
                          <option value="Double">Double</option>
                          <option value="Suite">Suite</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={passenger.hotel}
                          onChange={(e) =>
                            updatePassenger(index, "hotel", e.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {tours
                            .find((t) => t.name === selectedTour)
                            ?.hotels.map((hotel) => (
                              <option key={hotel} value={hotel}>
                                {hotel}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          multiple
                          value={passenger.additionalServices}
                          onChange={(e) =>
                            updatePassenger(
                              index,
                              "additionalServices",
                              Array.from(e.target.selectedOptions, (option) => option.value)
                            )
                          }
                        >
                          {tours
                            .find((t) => t.name === selectedTour)
                            ?.services.map((service) => (
                              <option key={service.name} value={service.name}>
                                {service.name} (${service.price})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>{passenger.price}</td>
                      <td>
                        <input
                          type="email"
                          className="form-control"
                          value={passenger.email}
                          onChange={(e) =>
                            updatePassenger(index, "email", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="tel"
                          className="form-control"
                          value={passenger.phone}
                          onChange={(e) =>
                            updatePassenger(index, "phone", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="file"
                          className="form-control"
                          onChange={(e) =>
                            updatePassenger(
                              index,
                              "passportUpload",
                              e.target.files ? e.target.files[0] : undefined
                            )
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => removePassenger(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={13}></td>
                    <td className="total-cell" id="totalPrice">
                      Total: {passengers.reduce((sum, p) => sum + p.price, 0)}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button type="button" className="btn btn-primary me-2" onClick={addPassenger}>
              Add Passenger
            </button>
            <button type="button" className="btn btn-primary me-2" onClick={saveOrder}>
              Save Order
            </button>
            <button type="button" className="btn btn-primary" onClick={downloadCSV}>
              Download as CSV
            </button>
          </form>
        ) : (
          <div>
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
        )}
      </div>
    </div>
  );
}

export default UserInterface;