import { useState, useMemo } from "react";
import { supabase } from "../supabaseClient";
import type { Order, User as UserType } from "../types/type";
import { formatDate } from "../utils/tourUtils";
import { useNotifications } from "../hooks/useNotifications";

interface OrdersTabProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
}

export default function OrdersTab({ orders, setOrders, currentUser }: OrdersTabProps) {
  const { showNotification } = useNotifications();
  const [customerNameFilter, setCustomerNameFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tourTitleFilter, setTourTitleFilter] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState<boolean>(false); // Toggle edit mode for the table
  const [showCompletedOnly, setShowCompletedOnly] = useState<boolean>(false); // Toggle for completed orders
  const ordersPerPage = 10;

  const handleOrderChange = (id: string, field: keyof Order, value: any) => {
    setOrders((prevOrders) =>
      prevOrders.map((o) => {
        if (o.id === id) {
          const updatedOrder = { ...o, [field]: value };
          if (field === "status" && value === "Completed") {
            showNotification("success", "Travel done completely! Good Job 😎");
          }
          return updatedOrder;
        }
        return o;
      })
    );
  };

  const handleSaveEdits = async () => {
    const updatedOrders = showCompletedOnly ? orders : orders.filter((order) => order.status !== "Travel ended completely" && order.status !== "Completed");
    const previousOrders = [...updatedOrders];
    try {
      const updates = updatedOrders.map((order) =>
        supabase
          .from("orders")
          .update({ ...order, updated_at: new Date().toISOString(), edited_by: currentUser.id })
          .eq("id", order.id)
      );
      const results = await Promise.all(updates);
      const hasError = results.some((result) => result.error);
      if (hasError) {
        const error = results.find((result) => result.error)?.error;
        console.error("Error updating orders:", error);
        if (error?.code === "23514") {
          showNotification("error", `Invalid status or value: ${error.message}. Choose from allowed statuses.`);
        } else {
          showNotification("error", `Failed to update orders: ${error?.message || "Unknown error"}`);
        }
        setOrders(previousOrders); // Revert on error
      } else {
        showNotification("success", "Saved completely! 😎");
        setIsEditMode(false); // Exit edit mode after successful save
      }
    } catch (error) {
      console.error("Unexpected error updating orders:", error);
      showNotification("error", "An unexpected error occurred while updating orders.");
      setOrders(previousOrders);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    const previousOrders = [...orders];
    setOrders(orders.filter((o) => o.id !== id));
    try {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) {
        console.error("Error deleting order:", error);
        showNotification("error", `Failed to delete order: ${error.message}`);
        setOrders(previousOrders);
      } else {
        showNotification("success", "Order deleted successfully");
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Unexpected error deleting order:", error);
      showNotification("error", "An unexpected error occurred while deleting the order.");
      setOrders(previousOrders);
    }
  };

  const filteredOrders = useMemo(() => {
    // Sort by departureDate first (nearest to furthest)
    return [...orders]
      .sort((a, b) => {
        const dateA = a.departureDate ? new Date(a.departureDate) : new Date(0); // Treat empty as far past
        const dateB = b.departureDate ? new Date(b.departureDate) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      })
      .filter((order) => {
        const customerName = `${order.first_name} ${order.last_name}`.toLowerCase();
        const matchesCustomerName = customerName.includes(customerNameFilter.toLowerCase());
        const matchesStatus = statusFilter === "all" || order.status === statusFilter;
        const matchesTourTitle = order.tour?.toLowerCase().includes(tourTitleFilter.toLowerCase()) || "";
        const isCompleted = order.status === "Completed";
        return matchesCustomerName && matchesStatus && matchesTourTitle && (showCompletedOnly ? isCompleted : !isCompleted && order.status !== "Travel ended completely");
      });
  }, [orders, customerNameFilter, statusFilter, tourTitleFilter, showCompletedOnly]);

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ordersPerPage;
    return filteredOrders.slice(startIndex, startIndex + ordersPerPage);
  }, [filteredOrders, currentPage]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      "Information given": "bg-blue-100 text-blue-800 border-blue-200",
      "Need to give information": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "Need to tell got a seat/in waiting": "bg-purple-100 text-purple-800 border-purple-200",
      "Need to conclude a contract": "bg-green-100 text-green-800 border-green-200",
      "Concluded a contract": "bg-teal-100 text-teal-800 border-teal-200",
      "Postponed the travel": "bg-orange-100 text-orange-800 border-orange-200",
      "Interested in other travel": "bg-pink-100 text-pink-800 border-pink-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
      "Cancelled after confirmed": "bg-red-200 text-red-900 border-red-300",
      "Cancelled after ordered a seat": "bg-red-300 text-red-900 border-red-400",
      "Cancelled after take a information": "bg-red-400 text-red-900 border-red-500",
      "Paid the advance payment": "bg-indigo-100 text-indigo-800 border-indigo-200",
      "Need to meet": "bg-gray-100 text-gray-800 border-gray-200",
      "Sent a claim": "bg-red-100 text-red-800 border-red-200",
      "Fam Tour": "bg-violet-100 text-violet-800 border-violet-200",
      confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      "The travel is going": "bg-blue-200 text-blue-900 border-blue-300",
      "Has taken seat from another company": "bg-orange-200 text-orange-900 border-orange-300",
      "Swapped seat with another company": "bg-purple-200 text-purple-900 border-purple-300",
      "Gave seat to another company": "bg-teal-200 text-teal-900 border-teal-300",
      "Cancelled and bought travel from another country": "bg-red-500 text-white border-red-600",
      Completed: "bg-gray-200 text-gray-900 border-gray-300"
    };
    return statusConfig[status as keyof typeof statusConfig] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 border-b border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Orders Management</h3>
            <p className="text-gray-600 mt-1">Manage and track all tour orders</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-full shadow-sm border">
            <span className="text-sm font-medium text-gray-600">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">👤 Search by Customer Name</label>
            <div className="relative">
              <input
                type="text"
                value={customerNameFilter}
                onChange={(e) => setCustomerNameFilter(e.target.value)}
                placeholder="Enter customer name..."
                className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:ring-3 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 bg-white shadow-sm"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">🏷️ Tour Title</label>
            <div className="relative">
              <input
                type="text"
                value={tourTitleFilter}
                onChange={(e) => setTourTitleFilter(e.target.value)}
                placeholder="Search by tour title..."
                className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:ring-3 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 bg-white shadow-sm"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">📊 Status Filter</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-3 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 bg-white shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">⏳ pending</option>
              <option value="confirmed">✅ confirmed</option>
              <option value="cancelled">❌ cancelled</option>
              <option value="Information given">ℹ️ Information given</option>
              <option value="Need to give information">📝 Need to give information</option>
              <option value="Need to tell got a seat/in waiting">🪑 Need to tell got a seat/in waiting</option>
              <option value="Need to conclude a contract">📑 Need to conclude a contract</option>
              <option value="Concluded a contract">✅ Concluded a contract</option>
              <option value="Postponed the travel">⏳ Postponed the travel</option>
              <option value="Interested in other travel">🌍 Interested in other travel</option>
              <option value="Cancelled after confirmed">❌ Cancelled after confirmed</option>
              <option value="Cancelled after ordered a seat">❌ Cancelled after ordered a seat</option>
              <option value="Cancelled after take a information">❌ Cancelled after take a information</option>
              <option value="Paid the advance payment">💸 Paid the advance payment</option>
              <option value="Need to meet">🤝 Need to meet</option>
              <option value="Sent a claim">⚠️ Sent a claim</option>
              <option value="Fam Tour">👨‍👩‍👧 Fam Tour</option>
              <option value="The travel is going">✈️ The travel is going</option>
              <option value="Has taken seat from another company">🪑 Has taken seat from another company</option>
              <option value="Swapped seat with another company">🔄 Swapped seat with another company</option>
              <option value="Gave seat to another company">🎁 Gave seat to another company</option>
              <option value="Cancelled and bought travel from another country">🌐 Cancelled and bought travel from another country</option>
              <option value="Completed">🏁 Completed</option>
            </select>
            <div className="mt-2">
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="w-full px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-all duration-200 font-semibold text-sm"
              >
                {isEditMode ? "Cancel Edit 😎" : "Edit Orders xD"}
              </button>
              {isEditMode && (
                <button
                  onClick={handleSaveEdits}
                  className="w-full mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all duration-200 font-semibold text-sm"
                >
                  Save Changes
                </button>
              )}
              <button
                onClick={() => {
                  setShowCompletedOnly(!showCompletedOnly);
                  setStatusFilter("all"); // Reset status filter when toggling
                  showNotification("success", showCompletedOnly ? "Back to all orders! 😎" : "Showing completed orders! xD");
                }}
                className="w-full mt-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-all duration-200 font-semibold text-sm"
              >
                {showCompletedOnly ? "Show All Orders 😎" : "Show Completed Orders xD"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 overflow-x-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 w-28 shadow-sm border-r border-gray-200">
                Order ID
              </th>
              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-24 z-10 bg-gray-50 w-28 shadow-sm border-r border-gray-200">Tour</th>
              <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-68 z-10 bg-gray-50 w-28 shadow-sm border-r border-gray-200">Passenger</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Departure</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Total Price</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Hotel</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Room</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Payment</th>
              <th className="px-28 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Show to Provider</th>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-50">
            {paginatedOrders.map((order, index) => (
              <tr key={order.id} className={`hover:bg-blue-25 transition-all duration-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                <td className="px-4 py-2 whitespace-nowrap sticky left-0 z-10 bg-white w-28 shadow-sm border-r border-gray-100">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                    <div className="text-sm font-bold text-gray-900 bg-gray-50 px-2 py-1 rounded-full">
                      #{order.id}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 whitespace-nowrap sticky left-24 z-10 bg-white w-28 shadow-sm border-r border-gray-100">
                  <input
                    type="text"
                    value={order.tour || ""}
                    onChange={(e) => handleOrderChange(order.id, "tour", e.target.value)}
                    className="w-full min-w-[140px] px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-white hover:border-gray-300"
                    disabled={!isEditMode}
                    placeholder="Tour title..."
                  />
                </td>
                <td className="px-4 py-2 whitespace-nowrap sticky left-68 z-10 bg-white w-28 shadow-sm border-r border-gray-100">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {order.first_name} {order.last_name}
                    </div>
                    <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full inline-block">
                      {order.email}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <input
                      type="date"
                      value={order.departureDate || ""}
                      onChange={(e) => handleOrderChange(order.id, "departureDate", e.target.value)}
                      className="w-full min-w-[120px] px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-white hover:border-gray-300"
                      disabled={!isEditMode}
                    />
                    <div className="text-xs text-gray-500 font-medium">
                      {formatDate(order.departureDate)}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={order.total_price || ""}
                      onChange={(e) => handleOrderChange(order.id, "total_price", parseFloat(e.target.value) || 0)}
                      className="w-full min-w-[100px] pl-6 pr-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-white hover:border-gray-300"
                      disabled={!isEditMode}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={order.hotel || ""}
                    onChange={(e) => handleOrderChange(order.id, "hotel", e.target.value)}
                    className="w-full min-w-[120px] px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-white hover:border-gray-300"
                    disabled={!isEditMode}
                    placeholder="Hotel name..."
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={order.room_number || ""}
                    onChange={(e) => handleOrderChange(order.id, "room_number", e.target.value)}
                    className="w-full min-w-[80px] px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-white hover:border-gray-300"
                    disabled={!isEditMode}
                    placeholder="Room #..."
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={order.payment_method || ""}
                    onChange={(e) => handleOrderChange(order.id, "payment_method", e.target.value)}
                    className="w-full min-w-[100px] px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 bg-white hover:border-gray-300"
                    disabled={!isEditMode}
                  >
                    <option value="">Select method</option>
                    <option value="manual">💰 Cash</option>
                    <option value="credit_card">💳 Credit Card</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={order.status || "pending"}
                    onChange={(e) => handleOrderChange(order.id, "status", e.target.value)}
                    className={`w-full min-w-[100px] px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 font-semibold ${getStatusBadge(order.status || "pending")}`}
                    disabled={!isEditMode}
                  >
                    <option value="pending">⏳ pending</option>
                    <option value="confirmed">✅ confirmed</option>
                    <option value="cancelled">❌ cancelled</option>
                    <option value="Information given">ℹ️ Information given</option>
                    <option value="Need to give information">📝 Need to give information</option>
                    <option value="Need to tell got a seat/in waiting">🪑 Need to tell got a seat/in waiting</option>
                    <option value="Need to conclude a contract">📑 Need to conclude a contract</option>
                    <option value="Concluded a contract">✅ Concluded a contract</option>
                    <option value="Postponed the travel">⏳ Postponed the travel</option>
                    <option value="Interested in other travel">🌍 Interested in other travel</option>
                    <option value="Cancelled after confirmed">❌ Cancelled after confirmed</option>
                    <option value="Cancelled after ordered a seat">❌ Cancelled after ordered a seat</option>
                    <option value="Cancelled after take a information">❌ Cancelled after take a information</option>
                    <option value="Paid the advance payment">💸 Paid the advance payment</option>
                    <option value="Need to meet">🤝 Need to meet</option>
                    <option value="Sent a claim">⚠️ Sent a claim</option>
                    <option value="Fam Tour">👨‍👩‍👧 Fam Tour</option>
                    <option value="The travel is going">✈️ The travel is going</option>
                    <option value="Has taken seat from another company">🪑 Has taken seat from another company</option>
                    <option value="Swapped seat with another company">🔄 Swapped seat with another company</option>
                    <option value="Gave seat to another company">🎁 Gave seat to another company</option>
                    <option value="Cancelled and bought travel from another country">🌐 Cancelled and bought travel from another country</option>
                    <option value="Completed">🏁 Completed</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={order.show_in_provider || false}
                        onChange={(e) => handleOrderChange(order.id, "show_in_provider", e.target.checked)}
                        className="sr-only peer"
                        disabled={!isEditMode}
                      />
                      <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {order.show_in_provider ? '✅' : '❌'}
                      </span>
                    </label>
                  </div>
                </td>
                <td className="px-3 py-2">
                  {showDeleteConfirm === order.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDeleteOrder(order.id)}
                        className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all duration-200 shadow-sm font-semibold text-sm"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-all duration-200 shadow-sm font-semibold text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(order.id)}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all duration-200 group"
                      title="Delete order"
                    >
                      <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length > ordersPerPage && (
          <div className="flex justify-end p-4">
            <div className="flex space-x-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">Try adjusting your search filters to find what you're looking for.</p>
          </div>
        )}
      </div>
    </div>
  );
}