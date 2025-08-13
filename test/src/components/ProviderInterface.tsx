// Import useState hook from React for managing component state
import { useState } from "react";

// Import specific icons from lucide-react for user interface elements
import { FileText, Eye, MapPin, Users, Calendar, CheckCircle, XCircle, Download } from "lucide-react";

// Import TypeScript type definitions (Order, Tour, User) from "../types/type" for type safety
import type { Order, Tour, User as UserType } from "../types/type";

// Define the props interface for the ProviderInterface component, specifying expected props and their types
interface ProviderInterfaceProps {
  orders: Order[]; // Array of orders to display and manage
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>; // Function to update the orders state
  tours: Tour[]; // Array of available tours
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>; // Function to update the tours state
  currentUser: UserType; // Information of the currently logged-in user
  onLogout: () => void; // Function to handle logout action
}

// Define the ProviderInterface functional component, receiving typed props
function ProviderInterface({
  orders, // Orders array
  setOrders, // Function to update orders
  tours, // Tours array
  currentUser, // Current user
  onLogout, // Logout function
}: ProviderInterfaceProps) {
  // State to store the currently selected order (null if none selected)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // State to store the selected departure date for filtering orders
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Function to update an order's status and set the creator to the current user
  const updateOrderStatus = (orderId: string, status: string) => {
    setOrders(
      orders.map((o) =>
        o.id === orderId ? { ...o, status, createdBy: currentUser.username } : o
      ) // Update the status and createdBy for the matching order ID
    );
    alert("Order status updated!"); // Show confirmation alert
  };

  // Get unique departure dates from orders and sort them
  const uniqueDates = Array.from(
    new Set(orders.map((order) => new Date(order.departureDate).toLocaleDateString()))
  ).sort();

  // Filter orders based on the selected date (show all orders if no date is selected)
  const filteredOrders = selectedDate
    ? orders.filter(
        (order) => new Date(order.departureDate).toLocaleDateString() === selectedDate
      )
    : orders;

  // New feature: Generate and download a CSV file with passenger information for orders matching the selected date
  const downloadPassengerCSV = () => {
    // Generate CSV only if a date is selected
    if (!selectedDate) {
      alert("Please select a departure date first!"); // Prompt user to select a date
      return;
    }

    // CSV file headers
    const headers = [
      "Order ID",
      "Tour",
      "Departure Date",
      "Passenger Name",
      "Nationality",
      "Room Type",
      "Hotel",
      "Price",
      "Status",
    ];

    // Collect passenger data from all orders matching the selected date
    const rows = filteredOrders.flatMap((order) =>
      order.passengers.map((passenger) => [
        order.id, // Order ID
        `"${order.tour}"`, // Tour name (wrapped in quotes to handle commas)
        new Date(order.departureDate).toLocaleDateString(), // Departure date
        `"${passenger.firstName} ${passenger.lastName}"`, // Passenger full name (wrapped in quotes)
        passenger.nationality, // Nationality
        passenger.roomType, // Room type
        passenger.hotel, // Hotel
        passenger.price, // Price
        order.status, // Order status
      ])
    );

    // Convert headers and data rows to CSV format
    const csvContent = [
      headers.join(","), // Header row
      ...rows.map((row) => row.join(",")), // Data rows
    ].join("\n");

    // Create a Blob object to generate the CSV file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    // Create a temporary download link
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `passengers_${selectedDate.replace(/\//g, "-")}.csv`); // File name includes date
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click(); // Trigger download
    document.body.removeChild(link); // Remove temporary link
  };

  // Render the component UI
  return (
    // Main container with minimum screen height and light gray background
    <div className="min-h-screen bg-gray-50">
      {/* Header section with shadow and bottom border */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Provider Dashboard</h1> {/* Dashboard title */}
              <p className="text-sm text-gray-600 mt-1">Manage your tour orders</p> {/* Subtitle */}
            </div>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout {/* Logout button */}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats section displaying orders, passengers, and tours counts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Orders</p> {/* Label */}
                <p className="text-2xl font-bold text-gray-900">{orders.length}</p> {/* Display total orders */}
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" /> {/* Orders icon */}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Passengers</p> {/* Label */}
                <p className="text-2xl font-bold text-gray-900">
                  {orders.reduce((sum, order) => sum + order.passengers.length, 0)} {/* Total passengers across all orders */}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" /> {/* Passengers icon */}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tours</p> {/* Label */}
                <p className="text-2xl font-bold text-gray-900">{tours.length}</p> {/* Display total tours */}
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="w-6 h-6 text-purple-600" /> {/* Tours icon */}
              </div>
            </div>
          </div>
        </div>

        {/* Orders management section */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <FileText className="w-5 h-5 mr-2" /> {/* Title icon */}
              {selectedOrder ? "Order Details" : "All Orders"} {/* Display title based on whether an order is selected */}
            </h3>
            {!selectedOrder && (
              <div className="flex items-center space-x-4">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)} // Update selected date on change
                >
                  <option value="">All Dates</option> {/* Option to show all orders */}
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {date} {/* List unique departure dates */}
                    </option>
                  ))}
                </select>
                <button
                  onClick={downloadPassengerCSV}
                  disabled={!selectedDate} // Disable button if no date is selected
                  className={`px-4 py-2 rounded-lg flex items-center ${
                    selectedDate
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  } transition-colors`}
                >
                  <Download className="w-5 h-5 mr-2" /> {/* Download icon */}
                  Download Passengers CSV
                </button>
              </div>
            )}
          </div>

          {selectedOrder ? (
            // Display details of the selected order
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                    <MapPin className="w-8 h-8 text-blue-600 mr-3" /> {/* Tour icon */}
                    <div>
                      <h4 className="font-medium text-gray-900">Tour</h4> {/* Label */}
                      <p className="text-sm text-gray-600">{selectedOrder.tour}</p> {/* Tour name */}
                    </div>
                  </div>
                  <div className="flex items-center p-4 bg-green-50 rounded-lg">
                    <Calendar className="w-8 h-8 text-green-600 mr-3" /> {/* Date icon */}
                    <div>
                      <h4 className="font-medium text-gray-900">Departure Date</h4> {/* Label */}
                      <p className="text-sm text-gray-600">
                        {new Date(selectedOrder.departureDate).toLocaleDateString()} {/* Formatted departure date */}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center p-4 bg-purple-50 rounded-lg">
                    <Users className="w-8 h-8 text-purple-600 mr-3" /> {/* Passengers icon */}
                    <div>
                      <h4 className="font-medium text-gray-900">Total Passengers</h4> {/* Label */}
                      <p className="text-sm text-gray-600">{selectedOrder.passengers.length}</p> {/* Number of passengers */}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Update Status</h4> {/* Label */}
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)} // Update order status on change
                    >
                      <option value="pending">Pending</option> {/* Status option: Pending */}
                      <option value="confirmed">Confirmed</option> {/* Status option: Confirmed */}
                      <option value="cancelled">Cancelled</option> {/* Status option: Cancelled */}
                    </select>
                  </div>
                </div>
              </div>

              <h4 className="font-medium text-gray-900 mb-4">Passenger Details</h4> {/* Passenger details title */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name {/* Table header: Name */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nationality {/* Table header: Nationality */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Room Type {/* Table header: Room Type */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hotel {/* Table header: Hotel */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price {/* Table header: Price */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedOrder.passengers.map((passenger) => (
                      <tr key={passenger.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.firstName} {passenger.lastName} {/* Passenger full name */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.nationality} {/* Passenger nationality */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.roomType} {/* Passenger room type */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {passenger.hotel} {/* Passenger hotel */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${passenger.price} {/* Passenger price */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Back to Orders {/* Button to return to orders list */}
                </button>
              </div>
            </div>
          ) : (
            // Display all orders or orders filtered by date
            <div className="overflow-x-auto">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" /> {/* Icon for no orders */}
                  <p className="text-gray-500">
                    {selectedDate
                      ? `No orders found for ${selectedDate}.` // Message for no orders on selected date
                      : "No orders available yet."} // Message for no orders available
                  </p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID {/* Table header: Order ID */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tour {/* Table header: Tour */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Departure {/* Table header: Departure */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Passengers {/* Table header: Passengers */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status {/* Table header: Status */}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions {/* Table header: Actions */}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          #{order.id} {/* Order ID */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" /> {/* Tour icon */}
                            {order.tour} {/* Tour name */}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1 text-gray-400" /> {/* Date icon */}
                            {new Date(order.departureDate).toLocaleDateString()} {/* Formatted departure date */}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3 mr-1" /> {/* Passengers icon */}
                            {order.passengers.length} {/* Number of passengers */}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.status === "confirmed"
                                ? "bg-green-100 text-green-800"
                                : order.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {order.status === "confirmed" ? (
                              <CheckCircle className="w-3 h-3 mr-1" /> // Confirmed status icon
                            ) : order.status === "cancelled" ? (
                              <XCircle className="w-3 h-3 mr-1" /> // Cancelled status icon
                            ) : (
                              <FileText className="w-3 h-3 mr-1" /> // Pending status icon
                            )}
                            {order.status} {/* Order status */}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-4 h-4" /> {/* View order details button icon */}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Tours overview section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <MapPin className="w-5 h-5 mr-2" /> {/* Title icon */}
            Available Tours {/* Available tours title */}
          </h3>
          {tours.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" /> {/* Icon for no tours */}
              <p className="text-gray-500">No tours available yet.</p> {/* Message for no available tours */}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {tours.map((tour) => (
                <div key={tour.id} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900">{tour.title}</h4> {/* Tour title */}
                  <p className="text-sm text-gray-600 mt-1">{tour.description}</p> {/* Tour description */}
                  <div className="mt-2 text-sm text-gray-600">
                    <p>
                      <strong>Seats:</strong> {tour.seats} {/* Number of seats */}
                    </p>
                    <p>
                      <strong>Dates:</strong>{" "}
                      {tour.dates.map((d) => new Date(d).toLocaleDateString()).join(", ")} {/* Formatted list of dates */}
                    </p>
                    <p>
                      <strong>Hotels:</strong> {tour.hotels.join(", ")} {/* List of hotels */}
                    </p>
                    <p>
                      <strong>Services:</strong>{" "}
                      {tour.services.map((s) => `${s.name} ($${s.price})`).join(", ")} {/* List of services with prices */}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export the ProviderInterface component as the default export
export default ProviderInterface;