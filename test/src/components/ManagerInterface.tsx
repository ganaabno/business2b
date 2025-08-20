import { useState, useMemo } from "react";
import type { User as UserType, Tour, Order, Passenger } from "../types/type";
import { supabase } from "../supabaseClient";

interface ManagerInterfaceProps {
  tours: Tour[];
  setTours: (tours: Tour[]) => void;
  orders: Order[];
  setOrders: (tours: Order[]) => void;
  passengers: Passenger[];
  setPassengers: (passengers: Passenger[]) => void;
  currentUser: UserType;
  onLogout: () => void;
}

export default function ManagerInterface({
  tours,
  setTours,
  orders,
  setOrders,
  passengers,
  setPassengers,
  currentUser,
  onLogout,
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

  const handleTourChange = async (id: string, field: keyof Tour, value: any) => {
    const updatedTours = tours.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    );
    setTours(updatedTours);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Error updating tour:', error);
        alert(`Failed to update tour: ${error.message}`);
        // Revert state on failure
        setTours(tours);
      }
    } catch (error) {
      console.error('Unexpected error updating tour:', error);
      alert('An unexpected error occurred while updating the tour.');
      setTours(tours);
    }
  };

  const handleOrderChange = async (id: string, field: keyof Order, value: any) => {
    const previousOrders = [...orders]; // Save previous state for rollback
    const updatedOrders = orders.map(o =>
      o.id === id ? { ...o, [field]: value, edited_by: currentUser.id, edited_at: new Date().toISOString() } : o
    );
    setOrders(updatedOrders);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ [field]: value, edited_by: currentUser.id, edited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Error updating order:', error);
        alert(`Failed to update order: ${error.message}`);
        setOrders(previousOrders); // Revert state on failure
      } else {
        alert(`${field === 'status' && value === 'Confirmed' ? 'Order marked as visible to providers' : 'Order updated successfully'}`);
      }
    } catch (error) {
      console.error('Unexpected error updating order:', error);
      alert('An unexpected error occurred while updating the order.');
      setOrders(previousOrders);
    }
  };

  const handlePassengerChange = async (id: string, field: keyof Passenger, value: any) => {
    const previousPassengers = [...passengers];
    const updatedPassengers = passengers.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    );
    setPassengers(updatedPassengers);
    try {
      const { error } = await supabase
        .from('passengers')
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.error('Error updating passenger:', error);
        alert(`Failed to update passenger: ${error.message}`);
        setPassengers(previousPassengers);
      }
    } catch (error) {
      console.error('Unexpected error updating passenger:', error);
      alert('An unexpected error occurred while updating the passenger.');
      setPassengers(previousPassengers);
    }
  };

  const handleAddTour = async () => {
    if (!newTour.departure_date) {
      alert("Departure date is required");
      return;
    }
    if (!newTour.title.trim()) {
      alert("Tour title is required");
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

    try {
      const { data, error } = await supabase
        .from("tours")
        .insert([tourData])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        alert("Error adding tour: " + error.message);
        return;
      }

      setTours([...tours, data as Tour]);
      setNewTour({
        title: "",
        name: "",
        departure_date: "",
        seats: "",
        hotels: "",
        services: "",
        description: "",
      });
      alert("Tour added successfully!");
    } catch (error) {
      console.error("Error adding tour:", error);
      alert("An unexpected error occurred while adding the tour.");
    }
  };

  const handleDeleteTour = async (id: string) => {
    const previousTours = [...tours];
    setTours(tours.filter(t => t.id !== id));
    try {
      const { error } = await supabase.from('tours').delete().eq('id', id);
      if (error) {
        console.error('Error deleting tour:', error);
        alert(`Failed to delete tour: ${error.message}`);
        setTours(previousTours);
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Unexpected error deleting tour:', error);
      alert('An unexpected error occurred while deleting the tour.');
      setTours(previousTours);
    }
  };

  const handleDeletePassenger = async (id: string) => {
    const previousPassengers = [...passengers];
    setPassengers(passengers.filter(p => p.id !== id));
    try {
      const { error } = await supabase.from('passengers').delete().eq('id', id);
      if (error) {
        console.error('Error deleting passenger:', error);
        alert(`Failed to delete passenger: ${error.message}`);
        setPassengers(previousPassengers);
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Unexpected error deleting passenger:', error);
      alert('An unexpected error occurred while deleting the passenger.');
      setPassengers(previousPassengers);
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
      const orderIdString = passenger.order_id != null ? String(passenger.order_id) : '';
      const matchesOrder = orderIdString.toLowerCase().includes(passengerOrderFilter.toLowerCase());
      const matchesStatus = passengerStatusFilter === "all" || passenger.status === passengerStatusFilter;
      return matchesName && matchesOrder && matchesStatus;
    });
  }, [passengers, passengerNameFilter, passengerOrderFilter, passengerStatusFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage your tours, orders, and passengers efficiently</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v-7a3 3 0 00-3-3H5" />
            </svg>
            Logout
          </button>
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
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Visible to Provider</th>
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={order.status === "confirmed"}
                          onChange={(e) => handleOrderChange(order.id, "status", e.target.checked ? "confirmed" : "pending")}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          title="Check to make visible to providers"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold mr-3 shadow-md">
                            {order.first_name?.charAt(0) || '?'}{order.last_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {order.first_name || 'N/A'} {order.last_name || 'N/A'}
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
                          value={order.departureDate || ""}
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
                          <option value="confirmed">✅ Confirmed</option>
                          <option value="cancelled">❌ Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-lg font-bold text-green-600">
                          ${order.commission?.toLocaleString() || 0}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 w-48 shadow-sm">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider sticky left-[108px] z-10 bg-gray-50 w-32 shadow-sm">Order ID</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">DOB</th>
                    <th className="px-10 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Age</th>
                    <th className="px-12 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gender</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Passport Expiry</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Nationality</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Room Allocation</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Hotel</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Additional Services</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Allergies</th>
                    <th className="px-24 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-18 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                    <th className="px-18 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Emergency Phone</th>
                    <th className="px-48 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-14 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPassengers.map((passenger) => (
                    <tr key={passenger.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-white w-48 shadow-sm">
                        <div className="text-sm font-medium text-gray-900">
                          {passenger.first_name} {passenger.last_name}
                        </div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap sticky left-[108px] z-10 bg-white w-32 shadow-sm">
                        <input
                          type="text"
                          value={passenger.order_id ?? ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "order_id", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Order ID..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          value={passenger.date_of_birth || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "date_of_birth", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          value={passenger.age || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "age", parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Age..."
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <select
                          value={passenger.gender || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "gender", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Select</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.passport_number || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "passport_number", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Passport..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          value={passenger.passport_expiry || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "passport_expiry", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.nationality || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "nationality", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Nationality..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.roomType || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "roomType", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Room Type..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.room_allocation || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "room_allocation", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Room Alloc..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.hotel || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "hotel", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Hotel..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.additional_services?.join(", ") || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "additional_services", e.target.value.split(",").map(s => s.trim()))}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Services..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={passenger.allergy || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "allergy", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Allergies..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="email"
                          value={passenger.email || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "email", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Email..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="tel"
                          value={passenger.phone || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "phone", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Phone..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <input
                          type="tel"
                          value={passenger.emergency_phone || ""}
                          onChange={(e) => handlePassengerChange(passenger.id, "emergency_phone", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Emergency..."
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <select
                          value={passenger.status || "active"}
                          onChange={(e) => handlePassengerChange(passenger.id, "status", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="active">✅ Active</option>
                          <option value="cancelled">❌ Cancelled</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  All Tours ({tours.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                {tours.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
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