import { useState, useMemo } from "react";
import type { Tour, Order, Passenger } from "../types/type";
import { supabase } from "../supabaseClient";

interface ManagerInterfaceProps {
  tours: Tour[];
  setTours: (tours: Tour[]) => void;
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  passengers: Passenger[];
  setPassengers: (passengers: Passenger[]) => void;
}

export default function ManagerInterface({
 tours,
  setTours,
  orders,
  setOrders,
  passengers,
  setPassengers,
}: ManagerInterfaceProps) {
  const [activeTab, setActiveTab] = useState<"tours" | "orders" | "addTour" | "passengers">("tours");
  const [newTour, setNewTour] = useState({
    title: "",
    name: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
    description: ""
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [titleFilter, setTitleFilter] = useState<string>("");
  const [dateFilterStart, setDateFilterStart] = useState<string>("");
  const [dateFilterEnd, setDateFilterEnd] = useState<string>("");
  const [passengerNameFilter, setPassengerNameFilter] = useState<string>("");
  const [passengerOrderFilter, setPassengerOrderFilter] = useState<string>("");
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<string>("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Not set";
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return "Invalid date";
    }
  };

  const handleTourChange = (id: string, field: keyof Tour, value: any) => {
    const updatedTours = tours.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    );
    setTours(updatedTours);
  };

  const handleOrderChange = (id: string, field: keyof Order, value: any) => {
    const updatedOrders = orders.map(o =>
      o.id === id ? { ...o, [field]: value } : o
    );
    setOrders(updatedOrders);
  };

  const handlePassengerChange = (id: string, field: keyof Passenger, value: any) => {
    const updatedPassengers = passengers.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    setPassengers(updatedPassengers);
  };

  const handleAddTour = async () => {
    const currentDate = new Date().toISOString();

    const newTourData: Partial<Tour> = {
      title: newTour.title,
      name: newTour.name || newTour.title,
      description: newTour.description,
      dates: newTour.departure_date ? [newTour.departure_date] : [],
      departureDate: newTour.departure_date,
      seats: parseInt(newTour.seats) || 0,
      hotels: newTour.hotels
        ? newTour.hotels.split(',').map(h => h.trim())
        : [],
      services: newTour.services
        ? newTour.services.split(',').map(s => ({ name: s.trim(), price: 0 }))
        : [],
      status: "active",
      created_at: currentDate,
      updated_at: currentDate,
      created_by: "manager"
    };

    try {
      const { data, error } = await supabase
        .from('tours')
        .insert([newTourData])
        .select()
        .single();

      if (error) throw error;

      setTours([...tours, data as Tour]);

      setNewTour({
        title: "",
        name: "",
        departure_date: "",
        seats: "",
        hotels: "",
        services: "",
        description: ""
      });
    } catch (error) {
      console.error('Error adding tour:', error);
    }
  };

  const handleDeleteTour = async (id: string) => {
    try {
      setTours(tours.filter(t => t.id !== id));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting tour:', error);
    }
  };

  const handleDeletePassenger = async (id: string) => {
    try {
      setPassengers(passengers.filter(p => p.id !== id));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting passenger:', error);
    }
  };

  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      const matchesTitle = tour.title.toLowerCase().includes(titleFilter.toLowerCase());
      const matchesStatus = statusFilter === "all" || tour.status === statusFilter;

      const tourDate = tour.departureDate || tour.dates?.[0];
      let matchesDate = true;

      if (tourDate) {
        const tourDateObj = new Date(tourDate);
        if (dateFilterStart) {
          const startDate = new Date(dateFilterStart);
          matchesDate = matchesDate && tourDateObj >= startDate;
        }
        if (dateFilterEnd) {
          const endDate = new Date(dateFilterEnd);
          matchesDate = matchesDate && tourDateObj <= endDate;
        }
      }

      return matchesTitle && matchesStatus && matchesDate;
    });
  }, [tours, titleFilter, statusFilter, dateFilterStart, dateFilterEnd]);

  const filteredPassengers = useMemo(() => {
    return passengers.filter(passenger => {
      const matchesName = `${passenger.first_name} ${passenger.last_name}`.toLowerCase().includes(passengerNameFilter.toLowerCase());
      const matchesOrder = passenger.order_id.toLowerCase().includes(passengerOrderFilter.toLowerCase());
      const matchesStatus = passengerStatusFilter === "all" || passenger.status === passengerStatusFilter;
      return matchesName && matchesOrder && matchesStatus;
    });
  }, [passengers, passengerNameFilter, passengerOrderFilter, passengerStatusFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage your tours, orders, and passengers efficiently</p>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {["tours", "orders", "addTour", "passengers"].map(tab => (
                <button
                  key={tab}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  onClick={() => setActiveTab(tab as "tours" | "orders" | "addTour" | "passengers")}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {tab === "tours" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      )}
                      {tab === "orders" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      )}
                      {tab === "addTour" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      )}
                      {tab === "passengers" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
                      )}
                    </svg>
                    <span>{tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                    {tab !== "addTour" && (
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-semibold ml-2">
                        {tab === "tours" ? tours.length : tab === "orders" ? orders.length : passengers.length}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === "tours" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tours</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search by Title</label>
                  <input
                    type="text"
                    value={titleFilter}
                    onChange={(e) => setTitleFilter(e.target.value)}
                    placeholder="Search tours..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                  <div className="flex space-x-2">
                    <input
                      type="date"
                      value={dateFilterStart}
                      onChange={(e) => setDateFilterStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <input
                      type="date"
                      value={dateFilterEnd}
                      onChange={(e) => setDateFilterEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="full">Full</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTours.map((tour) => (
                    <tr key={tour.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={tour.title}
                          onChange={(e) => handleTourChange(tour.id, "title", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Tour title..."
                        />
                        <textarea
                          value={tour.description || ""}
                          onChange={(e) => handleTourChange(tour.id, "description", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={2}
                          placeholder="Description..."
                        />
                        <input
                          type="text"
                          value={tour.hotels?.join(", ") || ""}
                          onChange={(e) => handleTourChange(tour.id, "hotels", e.target.value.split(",").map(h => h.trim()))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="Hotels (comma-separated)..."
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="date"
                          value={tour.departureDate || tour.dates?.[0] || ""}
                          onChange={(e) => {
                            handleTourChange(tour.id, "departureDate", e.target.value);
                            handleTourChange(tour.id, "dates", [e.target.value]);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                        <div className="text-sm text-gray-500 mt-1">
                          {formatDate(tour.departureDate || tour.dates?.[0])}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={tour.seats || ""}
                          onChange={(e) => handleTourChange(tour.id, "seats", parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="0"
                          placeholder="Seats"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={tour.status || "active"}
                          onChange={(e) => handleTourChange(tour.id, "status", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="active">✅ Active</option>
                          <option value="inactive">⏸️ Inactive</option>
                          <option value="full">🚫 Full</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {showDeleteConfirm === tour.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDeleteTour(tour.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(tour.id)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                            title="Delete tour"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passengers</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order, index) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold mr-3 shadow-md">
                            {order.first_name.charAt(0)}{order.last_name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.first_name} {order.last_name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={order.travel_choice}
                          onChange={(e) => handleOrderChange(order.id, "travel_choice", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150"
                          placeholder="Travel choice..."
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="date"
                          value={order.departureDate}
                          onChange={(e) => handleOrderChange(order.id, "departureDate", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 bg-white"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          👥 {order.passengers?.length || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status}
                          onChange={(e) => handleOrderChange(order.id, "status", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-150 bg-white text-sm"
                        >
                          <option value="pending">🟡 Pending</option>
                          <option value="Confirmed">✅ Confirmed</option>
                          <option value="Cancelled">❌ Cancelled</option>
                          <option value="Information given">📋 Information given</option>
                          <option value="Paid the advance payment">💰 Paid the advance payment</option>
                          <option value="Need to give information">📞 Need to give information</option>
                          <option value="Tell a seat is available">💺 Need to tell</option>
                          <option value="Need to conclude a contract">📑 Need to conclude a contract</option>
                          <option value="Postoned the travel">⏸️ Postponed the travel</option>
                          <option value="Intrested in other travel">🔍 Interested in other travel</option>
                          <option value="Cancelled after confirmed">🚫 Cancelled after confirmed</option>
                          <option value="Cancelled after ordered a seat">🚫 Cancelled after ordered a seat</option>
                          <option value="Cancelled after take a information">🚫 Cancelled after take a information</option>
                          <option value="Need to meet">🤝 Need to meet</option>
                          <option value="Sent a claim">📨 Sent a claim</option>
                          <option value="Fam Tour">👨‍👩‍👧‍👦 Fam Tour</option>
                          <option value="The travel is Going">✈️ The travel is going</option>
                          <option value="Travel ended compeletely">🏁 Travel ended completely</option>
                          <option value="Has taken seat from another company">🔄 Has taken seat from another company</option>
                          <option value="Swapped seat with a another company">🔄 Swapped seat with another company</option>
                          <option value="Gave seat to another company">↗️ Gave seat to another company</option>
                          <option value="cancelled and bought from another company">🔄 Cancelled and bought from another company</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-green-600">
                          ${order.total_price?.toLocaleString() || 0}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "passengers" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Passengers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search by Name</label>
                  <input
                    type="text"
                    value={passengerNameFilter}
                    onChange={(e) => setPassengerNameFilter(e.target.value)}
                    placeholder="Search passengers..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                  <input
                    type="text"
                    value={passengerOrderFilter}
                    onChange={(e) => setPassengerOrderFilter(e.target.value)}
                    placeholder="Search by order ID..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={passengerStatusFilter}
                    onChange={(e) => setPassengerStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPassengers.map((passenger) => (
                    <tr key={passenger.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {passenger.first_name} {passenger.last_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {passenger.order_id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          <p><span className="font-medium">DOB:</span> {formatDate(passenger.date_of_birth)}</p>
                          <p><span className="font-medium">Age:</span> {passenger.age}</p>
                          <p><span className="font-medium">Gender:</span> {passenger.gender}</p>
                          <p><span className="font-medium">Passport:</span> {passenger.passport_number}</p>
                          <p><span className="font-medium">Expiry:</span> {formatDate(passenger.passport_expiry)}</p>
                          <p><span className="font-medium">Nationality:</span> {passenger.nationality}</p>
                          <p><span className="font-medium">Room:</span> {passenger.roomType} ({passenger.room_allocation})</p>
                          <p><span className="font-medium">Hotel:</span> {passenger.hotel}</p>
                          {passenger.additional_services.length > 0 && (
                            <p><span className="font-medium">Services:</span> {passenger.additional_services.join(", ")}</p>
                          )}
                          <p><span className="font-medium">Allergies:</span> {passenger.allergy || "None"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          <p><span className="font-medium">Email:</span> {passenger.email}</p>
                          <p><span className="font-medium">Phone:</span> {passenger.phone}</p>
                          <p><span className="font-medium">Emergency:</span> {passenger.emergency_phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={passenger.status || "active"}
                          onChange={(e) => handlePassengerChange(passenger.id, "status", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="active">✅ Active</option>
                          <option value="cancelled">❌ Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {showDeleteConfirm === passenger.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleDeletePassenger(passenger.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setShowDeleteConfirm(null)}
                              className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(passenger.id)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                            title="Delete passenger"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "addTour" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Add New Tour
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.title}
                    onChange={(e) => setNewTour({ ...newTour, title: e.target.value })}
                    placeholder="Enter tour title..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.name}
                    onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
                    placeholder="Enter tour name..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departure Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    value={newTour.departure_date}
                    onChange={(e) => setNewTour({ ...newTour, departure_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.seats}
                    onChange={(e) => setNewTour({ ...newTour, seats: e.target.value })}
                    placeholder="Number of seats"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hotels (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="Hotel A, Hotel B, Hotel C"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.hotels}
                    onChange={(e) => setNewTour({ ...newTour, hotels: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Services</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newTour.services}
                    onChange={(e) => setNewTour({ ...newTour, services: e.target.value })}
                    placeholder="Tour services..."
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    value={newTour.description}
                    onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                    rows={3}
                    placeholder="Tour description..."
                  />
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={handleAddTour}
                  disabled={!newTour.title || !newTour.departure_date}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Tour
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  All Tours ({tours.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                {tours.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500">No tours available yet.</p>
                    <p className="text-sm text-gray-400 mt-1">Add your first tour using the form above.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tour Details</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Departure Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Seats</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tours.map((tour) => (
                        <tr key={tour.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{tour.title}</div>
                            {tour.name && tour.name !== tour.title && (
                              <div className="text-xs text-gray-500 mt-1">📛 {tour.name}</div>
                            )}
                            <div className="text-sm text-gray-500 mt-1">{tour.description || "No description"}</div>
                            {tour.hotels && tour.hotels.length > 0 && (
                              <div className="text-xs text-blue-600 mt-1">🏨 {tour.hotels.join(", ")}</div>
                            )}
                            {tour.services && tour.services.length > 0 && (
                              <div className="text-xs text-green-600 mt-1">
                                {tour.services.map((service, idx) => (
                                  <div key={idx}>🔧 {service.name} (${service.price})</div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(tour.departureDate || tour.dates?.[0])}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              💺 {tour.seats ?? "No limit"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${tour.status === 'active' ? 'bg-green-100 text-green-800' :
                                tour.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                                  tour.status === 'full' ? 'bg-red-100 text-red-800' :
                                    'bg-blue-100 text-blue-800'
                              }`}>
                              {tour.status === 'active' ? '✅ Active' :
                                tour.status === 'inactive' ? '⏸️ Inactive' :
                                  tour.status === 'full' ? '🚫 Full' :
                                    '📍 ' + (tour.status || 'Active')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {showDeleteConfirm === tour.id ? (
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleDeleteTour(tour.id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowDeleteConfirm(tour.id)}
                                className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-lg"
                                title="Delete tour"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
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
      </div>
    </div>
  );
}