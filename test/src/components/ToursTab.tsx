// ToursTab.tsx
import type { Tour } from "../types/type";
import { useTours } from "../hooks/useTours";

interface ToursTabProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
}

export default function ToursTab({ tours, setTours }: ToursTabProps) {
  const {
    filteredTours,
    titleFilter,
    setTitleFilter,
    statusFilter,
    setStatusFilter,
    dateFilterStart,
    setDateFilterStart,
    dateFilterEnd,
    setDateFilterEnd,
    showDeleteConfirm,
    setShowDeleteConfirm,
    handleTourChange,
    handleDeleteTour,
    formatDate,
  } = useTours(tours, setTours); // Pass isAdmin: true for admin view

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tours (Admin)</h3>
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
                    onChange={(e) => handleTourChange(tour.id, "hotels", e.target.value.split(",").map((h) => h.trim()))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-2 focus:ring-2 focus:ring-blue-500"
                    placeholder="Hotels (comma-separated)..."
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="date"
                    value={tour.dates?.[0] || ""}
                    onChange={(e) => handleTourChange(tour.id, "dates", [e.target.value])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <div className="text-sm text-gray-500 mt-1">{formatDate(tour.dates?.[0])}</div>
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
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
  );
}