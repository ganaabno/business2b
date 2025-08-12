import { useState, useEffect } from "react";
import {
  MapPin,
  Calendar,
  Users,
  Plus,
  Trash2,
  Download,
  Save,
  Plane,
  Hotel,
  Mail,
  Phone,
  CreditCard,
  FileText,
  Clock,
  DollarSign,
  Upload,
  Eye,
  User
} from "lucide-react";
import type { Tour, Order, User as UserType, Passenger } from "../types/type";

interface UserInterfaceProps {
  tours: Tour[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
  onLogout: () => void;
}

function UserInterface({ tours, orders, setOrders, currentUser, onLogout }: UserInterfaceProps) {
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [activeStep, setActiveStep] = useState(1);

  const countries = [
    "Mongolia", "Russia", "China", "Afghanistan", "Albania", "Algeria", "Argentina", "Armenia",
    "Australia", "Austria", "Azerbaijan", "Bangladesh", "Belarus", "Belgium", "Brazil", "Bulgaria",
    "Cambodia", "Canada", "Chile", "Colombia", "Czech Republic", "Denmark", "Egypt", "Estonia",
    "Finland", "France", "Georgia", "Germany", "Greece", "Hungary", "Iceland", "India", "Indonesia",
    "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait",
    "Kyrgyzstan", "Latvia", "Lebanon", "Lithuania", "Luxembourg", "Malaysia", "Mexico", "Netherlands",
    "New Zealand", "Norway", "Pakistan", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
    "Saudi Arabia", "Singapore", "Slovakia", "Slovenia", "South Africa", "South Korea", "Spain",
    "Sweden", "Switzerland", "Tajikistan", "Thailand", "Turkey", "Turkmenistan", "Ukraine",
    "United Arab Emirates", "United Kingdom", "United States", "Uzbekistan", "Vietnam", "Zimbabwe"
  ];

  const addPassenger = () => {
    setPassengers([
      ...passengers,
      {
        id: `passenger-${Date.now()}-${passengers.length}`,
        userId: currentUser.id || `user-${Date.now()}`,
        name: "",
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
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
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
    if (field === "firstName" || field === "lastName") {
      updatedPassengers[index].name = `${updatedPassengers[index].firstName} ${updatedPassengers[index].lastName}`.trim();
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

    const tourData = tours.find((t) => t.name === selectedTour);
    if (!tourData) {
      alert("Selected tour not found.");
      return;
    }

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      tourId: tourData.id,
      userId: currentUser.id || `user-${Date.now()}`,
      status: "pending",
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
    setActiveStep(1);
  };

  const downloadCSV = () => {
    const headers = [
      "Room Allocation", "Serial No", "Last Name", "First Name", "Date of Birth", "Age",
      "Gender", "Passport Number", "Passport Expiry", "Nationality", "Room Type", "Hotel",
      "Additional Services", "Price", "Email", "Phone"
    ];

    const rows = passengers.map((p) =>
      [
        p.roomAllocation, p.serialNo, p.lastName, p.firstName, p.dateOfBirth, p.age,
        p.gender, p.passportNumber, p.passportExpiry, p.nationality, p.roomType, p.hotel,
        p.additionalServices.join(","), p.price, p.email, p.phone
      ].map((v) => `"${v}"`).join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `booking_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const selectedTourData = tours.find((t) => t.name === selectedTour);
  const totalPrice = passengers.reduce((sum, p) => sum + p.price, 0);

  if (currentUser.role !== "user") {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Booking Overview</h1>
                <p className="text-sm text-gray-600 mt-1">View all tour bookings</p>
              </div>
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
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Passengers</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {orders.reduce((sum, order) => sum + order.passengers.length, 0)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Tours</p>
                  <p className="text-2xl font-bold text-gray-900">{tours.length}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tour</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passengers</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
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
                              <div className="text-sm font-medium text-gray-900">Booking #{order.id}</div>
                              <div className="text-sm text-gray-500">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {order.tour}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                            {order.departureDate}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3 mr-1" />
                            {order.passengers.length} passengers
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.createdBy}
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Book Your Adventure</h1>
              <p className="text-sm text-gray-600 mt-1">Plan your perfect tour experience</p>
            </div>
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
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { step: 1, title: "Select Tour", icon: MapPin },
              { step: 2, title: "Add Passengers", icon: Users },
              { step: 3, title: "Review & Book", icon: CreditCard }
            ].map(({ step, title, icon: Icon }) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${activeStep >= step
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-gray-300 text-gray-400"
                  }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`ml-2 text-sm font-medium ${activeStep >= step ? "text-blue-600" : "text-gray-400"
                  }`}>
                  {title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Tour Selection */}
        {activeStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Choose Your Tour
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tour Package</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedTour}
                  onChange={(e) => setSelectedTour(e.target.value)}
                >
                  <option value="">Select a tour...</option>
                  {tours.map((tour) => (
                    <option key={tour.id} value={tour.name}>
                      {tour.name} ({tour.seats} seats available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Departure Date</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  disabled={!selectedTour}
                >
                  <option value="">Select date...</option>
                  {selectedTourData?.dates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedTourData && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Tour Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                  <div className="flex items-center">
                    <Hotel className="w-4 h-4 mr-2" />
                    <span>Hotels: {selectedTourData.hotels.join(", ")}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    <span>Available Seats: {selectedTourData.seats}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setActiveStep(2)}
                disabled={!selectedTour || !departureDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Continue to Passengers
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Passenger Details */}
        {activeStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Passenger Information
              </h3>
              <button
                onClick={addPassenger}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Passenger
              </button>
            </div>

            {passengers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No passengers added yet</p>
                <button
                  onClick={addPassenger}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add First Passenger
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {passengers.map((passenger, index) => (
                  <div key={passenger.id} className="p-6 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-gray-900">Passenger {index + 1}</h4>
                      <button
                        onClick={() => removePassenger(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Room Allocation</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Room #"
                          value={passenger.roomAllocation}
                          onChange={(e) => updatePassenger(index, "roomAllocation", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Serial No</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Serial #"
                          value={passenger.serialNo}
                          onChange={(e) => updatePassenger(index, "serialNo", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="John"
                          value={passenger.firstName}
                          onChange={(e) => updatePassenger(index, "firstName", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Doe"
                          value={passenger.lastName}
                          onChange={(e) => updatePassenger(index, "lastName", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.dateOfBirth}
                          onChange={(e) => updatePassenger(index, "dateOfBirth", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Age</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50"
                          value={passenger.age || ""}
                          readOnly
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                        <select
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.gender}
                          onChange={(e) => updatePassenger(index, "gender", e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Nationality</label>
                        <select
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.nationality}
                          onChange={(e) => updatePassenger(index, "nationality", e.target.value)}
                        >
                          <option value="">Select Country</option>
                          {countries.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Passport Number</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="A12345678"
                          value={passenger.passportNumber}
                          onChange={(e) => updatePassenger(index, "passportNumber", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Passport Expiry</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.passportExpiry}
                          onChange={(e) => updatePassenger(index, "passportExpiry", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Room Type</label>
                        <select
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.roomType}
                          onChange={(e) => updatePassenger(index, "roomType", e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Single">Single</option>
                          <option value="Double">Double</option>
                          <option value="Suite">Suite</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Hotel</label>
                        <select
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={passenger.hotel}
                          onChange={(e) => updatePassenger(index, "hotel", e.target.value)}
                        >
                          <option value="">Select Hotel</option>
                          {selectedTourData?.hotels.map((hotel) => (
                            <option key={hotel} value={hotel}>
                              {hotel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Additional Services</label>
                        <select
                          multiple
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
                          value={passenger.additionalServices}
                          onChange={(e) =>
                            updatePassenger(
                              index,
                              "additionalServices",
                              Array.from(e.target.selectedOptions, (option) => option.value)
                            )
                          }
                        >
                          {selectedTourData?.services.map((service) => (
                            <option key={service.name} value={service.name}>
                              {service.name} (${service.price})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="john@example.com"
                          value={passenger.email}
                          onChange={(e) => updatePassenger(index, "email", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="+1 234 567 8900"
                          value={passenger.phone}
                          onChange={(e) => updatePassenger(index, "phone", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Passport Upload</label>
                        <div className="relative">
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="image/*,.pdf"
                            onChange={(e) =>
                              updatePassenger(
                                index,
                                "passportUpload",
                                e.target.files ? e.target.files[0] : undefined
                              )
                            }
                          />
                          <div className="flex items-center justify-center px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
                            <Upload className="w-4 h-4 mr-2 text-gray-400" />
                            <span className="text-gray-600">
                              {passenger.passportUpload ? passenger.passportUpload.name : "Upload"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Service Price</label>
                        <div className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50">
                          <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                          <span className="font-medium">${passenger.price}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() => setActiveStep(1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back to Tour Selection
              </button>
              <button
                onClick={() => setActiveStep(3)}
                disabled={passengers.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Review Booking
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Book */}
        {activeStep === 3 && (
          <div className="space-y-6">
            {/* Booking Summary */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                Booking Summary
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                    <MapPin className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Tour Package</h4>
                      <p className="text-sm text-gray-600">{selectedTour}</p>
                    </div>
                  </div>

                  <div className="flex items-center p-4 bg-green-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Departure Date</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(departureDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-purple-50 rounded-lg">
                    <Users className="w-8 h-8 text-purple-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Total Passengers</h4>
                      <p className="text-sm text-gray-600">{passengers.length} passengers</p>
                    </div>
                  </div>

                  <div className="flex items-center p-4 bg-orange-50 rounded-lg">
                    <DollarSign className="w-8 h-8 text-orange-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Total Price</h4>
                      <p className="text-lg font-bold text-gray-900">${totalPrice}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passenger List */}
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">Passenger Details</h4>
                <div className="space-y-3">
                  {passengers.map((passenger, index) => (
                    <div key={passenger.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {passenger.firstName} {passenger.lastName}
                          </p>
                          <p className="text-sm text-gray-600">
                            {passenger.nationality} • Room: {passenger.roomType} • Hotel: {passenger.hotel}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">${passenger.price}</p>
                        <p className="text-sm text-gray-600">
                          {passenger.additionalServices.length} services
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setActiveStep(2)}
                  className="flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Back to Passengers
                </button>

                <button
                  onClick={downloadCSV}
                  disabled={passengers.length === 0}
                  className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </button>

                <button
                  onClick={saveOrder}
                  className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-1"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Confirm Booking
                </button>
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Please ensure all passenger information is accurate before confirming.
                  All information should be entered in English or Latin characters only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Bar - Fixed at bottom for mobile */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 md:hidden">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Step {activeStep} of 3
            </div>
            <div className="text-sm font-medium text-gray-900">
              {passengers.length > 0 && `${passengers.length} passengers • $${totalPrice}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserInterface;