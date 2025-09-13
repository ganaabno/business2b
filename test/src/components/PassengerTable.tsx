import { useState } from "react";
import type { Passenger, ValidationError } from "../types/type";
import { Pencil, Trash2 } from "lucide-react";

interface PassengerTableProps {
  passengers: Passenger[];
  updatePassenger: (passengerId: string, field: keyof Passenger, value: any) => Promise<void>;
  removePassenger: (passengerId: string) => void;
  showNotification: (type: "success" | "error", message: string) => void;
  currentUserId: string;
}

export default function PassengerTable({
  passengers,
  updatePassenger,
  removePassenger,
  showNotification,
  currentUserId,
}: PassengerTableProps) {
  const [editingPassengerId, setEditingPassengerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Passenger>>({});
  const [editErrors, setEditErrors] = useState<ValidationError[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Format date for display
  const formatDisplayDate = (s: string | undefined): string => {
    if (!s) return "";
    const d = new Date(s);
    return !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : s;
  };

  // Start editing a passenger
  const startEditing = (passenger: Passenger) => {
    if (passenger.order_id !== "") {
      showNotification("error", "Cannot edit submitted passengers");
      return;
    }
    setEditingPassengerId(passenger.id);
    setEditForm({
      first_name: passenger.first_name,
      last_name: passenger.last_name,
      date_of_birth: passenger.date_of_birth,
      gender: passenger.gender,
      passport_number: passenger.passport_number,
      passport_expiry: passenger.passport_expiry,
      nationality: passenger.nationality,
      roomType: passenger.roomType,
      hotel: passenger.hotel,
      email: passenger.email,
      phone: passenger.phone,
    });
    setEditErrors([]);
  };

  // Handle form input changes
  const handleInputChange = (field: keyof Passenger, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  // Validate edit form
  const validateEditForm = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    if (!editForm.first_name?.trim()) errors.push({ field: `edit_first_name`, message: "First name is required" });
    if (!editForm.last_name?.trim()) errors.push({ field: `edit_last_name`, message: "Last name is required" });
    if (!editForm.email?.trim() || !/\S+@\S+\.\S+/.test(editForm.email))
      errors.push({ field: `edit_email`, message: "Valid email is required" });
    if (!editForm.phone?.trim()) errors.push({ field: `edit_phone`, message: "Phone number is required" });
    if (!editForm.nationality) errors.push({ field: `edit_nationality`, message: "Nationality is required" });
    if (!editForm.gender) errors.push({ field: `edit_gender`, message: "Gender is required" });
    if (!editForm.passport_number?.trim())
      errors.push({ field: `edit_passport_number`, message: "Passport number is required" });
    if (!editForm.passport_expiry)
      errors.push({ field: `edit_passport_expiry`, message: "Passport expiry date is required" });
    if (!editForm.roomType) errors.push({ field: `edit_roomType`, message: "Room type is required" });
    if (!editForm.hotel) errors.push({ field: `edit_hotel`, message: "Hotel selection is required" });
    return errors;
  };

  // Save edited passenger
  const saveEdit = async () => {
    if (!editingPassengerId) return;

    const errors = validateEditForm();
    if (errors.length > 0) {
      setEditErrors(errors);
      showNotification("error", "Please fix the validation errors");
      return;
    }

    try {
      for (const [field, value] of Object.entries(editForm)) {
        if (value !== undefined) {
          await updatePassenger(editingPassengerId, field as keyof Passenger, value);
        }
      }
      showNotification("success", "Passenger updated successfully");
      setEditingPassengerId(null);
      setEditForm({});
      setEditErrors([]);
    } catch (error) {
      showNotification("error", "Failed to update passenger");
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingPassengerId(null);
    setEditForm({});
    setEditErrors([]);
  };

  // Sort passengers by created_at descending
  const sortedPassengers = [...passengers].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Pagination logic
  const totalPages = Math.ceil(sortedPassengers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPassengers = sortedPassengers.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className="space-y-4">
      {sortedPassengers.length === 0 ? (
        <p className="text-gray-600">No passengers added yet. Add a passenger to continue.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Passport
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tour
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Departure
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedPassengers.map((passenger) => (
                  <tr key={passenger.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {passenger.first_name} {passenger.last_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {passenger.passport_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {passenger.tour_title}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDisplayDate(passenger.departure_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          passenger.status === "active"
                            ? "bg-green-100 text-green-800"
                            : passenger.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {passenger.order_id === "" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEditing(passenger)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit passenger"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removePassenger(passenger.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove passenger"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
            >
              Previous
            </button>
            <span className="self-center text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg disabled:bg-gray-200 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
            >
              Next
            </button>
          </div>
        </>
      )}

      {editingPassengerId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Edit Passenger</h3>
            {editErrors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <ul className="list-disc list-inside text-sm text-red-800">
                  {editErrors.map((error, index) => (
                    <li key={index}>{error.message}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  type="text"
                  value={editForm.first_name || ""}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  type="text"
                  value={editForm.last_name || ""}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  value={editForm.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.date_of_birth || ""}
                  onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Gender</label>
                <select
                  value={editForm.gender || ""}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Passport Number</label>
                <input
                  type="text"
                  value={editForm.passport_number || ""}
                  onChange={(e) => handleInputChange("passport_number", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Passport Expiry</label>
                <input
                  type="date"
                  value={editForm.passport_expiry || ""}
                  onChange={(e) => handleInputChange("passport_expiry", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nationality</label>
                <input
                  type="text"
                  value={editForm.nationality || ""}
                  onChange={(e) => handleInputChange("nationality", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Room Type</label>
                <select
                  value={editForm.roomType || ""}
                  onChange={(e) => handleInputChange("roomType", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select Room Type</option>
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                  <option value="Suite">Suite</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Hotel</label>
                <input
                  type="text"
                  value={editForm.hotel || ""}
                  onChange={(e) => handleInputChange("hotel", e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}