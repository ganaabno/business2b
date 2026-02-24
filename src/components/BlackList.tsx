import { useMemo, useState } from "react";
import { supabase } from "../supabaseClient"; // Import supabase client
import type { Passenger } from "../types/type";

interface BlackListTabProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  currentUser: any;
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function BlackListTab({
  passengers,
  setPassengers,
  showNotification,
  currentUser,
}: BlackListTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Passenger | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredAndSortedPassengers = useMemo(() => {
    let filtered = passengers.filter((p) => p.is_blacklisted);

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchLower) ||
          p.order_id?.toLowerCase().includes(searchLower) ||
          p.tour_title?.toLowerCase().includes(searchLower) ||
          p.notes?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];

        // Handle name sorting specially
        if (sortField === "first_name") {
          aValue = `${a.first_name} ${a.last_name}`;
          bValue = `${b.first_name} ${b.last_name}`;
        }

        // Handle null/undefined values
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;

        const comparison = String(aValue).localeCompare(String(bValue));
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [passengers, searchTerm, sortField, sortDirection]);

  const handleSort = (field: keyof Passenger) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRemoveFromBlacklist = async (passengerId: string) => {
    const previousPassengers = [...passengers]; // Store previous state for rollback
    try {
      // Optimistically update local state
      setPassengers((prev) =>
        prev.map((p) =>
          p.id === passengerId ? { ...p, is_blacklisted: false } : p
        )
      );

      // Update the is_blacklisted field in Supabase
      const { error } = await supabase
        .from("passengers")
        .update({
          is_blacklisted: false,
          updated_at: new Date().toISOString(),
          ...(currentUser.id && { edited_by: currentUser.id }),
        })
        .eq("id", passengerId);

      if (error) {
        console.error("Error removing passenger from blacklist:", error);
        showNotification("error", `Failed to remove passenger from blacklist: ${error.message}`);
        setPassengers(previousPassengers); // Rollback on error
        return;
      }

      showNotification("success", "Passenger removed from blacklist");
    } catch (error) {
      console.error("Unexpected error removing passenger from blacklist:", error);
      showNotification("error", "An unexpected error occurred while removing passenger from blacklist.");
      setPassengers(previousPassengers); // Rollback on error
    }
  };

  const getSortIcon = (field: keyof Passenger) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === "asc" ? (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
      </svg>
    );
  };

  function formatDate(date: string | Date | null): string {
    if (!date) return "—";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header with search */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Blacklisted Passengers</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filteredAndSortedPassengers.length} of {passengers.filter((p) => p.is_blacklisted).length} blacklisted passengers
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search passengers or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full mono-table divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort("first_name")}
              >
                <div className="flex items-center space-x-1">
                  <span>Name</span>
                  {getSortIcon("first_name")}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort("order_id")}
              >
                <div className="flex items-center space-x-1">
                  <span>Order ID</span>
                  {getSortIcon("order_id")}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort("tour_title")}
              >
                <div className="flex items-center space-x-1">
                  <span>Tour</span>
                  {getSortIcon("tour_title")}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => handleSort("notes")}
              >
                <div className="flex items-center space-x-1">
                  <span>Notes</span>
                  {getSortIcon("notes")}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date Added
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedPassengers.map((passenger) => (
              <tr key={passenger.id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8">
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-red-600">
                          {passenger.first_name?.charAt(0) || "?"}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900">
                        {passenger.first_name} {passenger.last_name}
                      </div>
                      {passenger.email && (
                        <div className="text-sm text-gray-500">{passenger.email}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {passenger.order_id ? (
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                        {passenger.order_id}
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {passenger.tour_title && passenger.tour_title.trim() !== "" ? (
                      passenger.tour_title
                    ) : (
                      <span className="text-gray-400">Unknown Tour</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {passenger.notes || "None"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(passenger.blacklisted_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleRemoveFromBlacklist(passenger.id)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-150"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredAndSortedPassengers.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? "No matching passengers found" : "No blacklisted passengers"}
            </h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              {searchTerm
                ? "Try adjusting your search terms to find what you're looking for."
                : "No passengers have been blacklisted yet."
              }
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer with stats */}
      {filteredAndSortedPassengers.length > 0 && (
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {filteredAndSortedPassengers.length} passenger
              {filteredAndSortedPassengers.length !== 1 ? "s" : ""}
            </span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
