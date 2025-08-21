import { useMemo } from "react";
import { MapPin, Calendar, Hotel, Package } from "lucide-react";
import type { Tour, ValidationError } from "../types/type";

interface TourSelectionProps {
  tours: Tour[];
  selectedTour: string;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  errors: ValidationError[];
  setActiveStep: (value: number) => void;
  userRole: string;
  showAvailableSeats?: boolean; // <-- add this
}


function formatDisplayDate(s: string | undefined): string {
  if (!s) return "";
  const d = new Date(s);
  return !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : s;
}

export default function TourSelection({
  tours,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  errors,
  setActiveStep,
  userRole,
}: TourSelectionProps) {
  const mergedTours = useMemo(() => {
    const map = new Map<string, Tour & { dates: string[] }>();

    for (const tour of tours) {
      if (!map.has(tour.title)) {
        map.set(tour.title, { ...tour, dates: [...(tour.dates || [])] });
      } else {
        const existing = map.get(tour.title)!;
        existing.dates = Array.from(new Set([...existing.dates, ...(tour.dates || [])]));
      }
    }

    return Array.from(map.values());
  }, [tours]);

  const selectedTourData = useMemo(
    () => mergedTours.find((tour) => tour.title === selectedTour),
    [mergedTours, selectedTour]
  );

  const hasTourError = errors.some((e) => e.field === "tour");
  const hasDepartureError = errors.some((e) => e.field === "departure");
  const hasDates = (selectedTourData?.dates?.length ?? 0) > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-6">
        <MapPin className="w-5 h-5 mr-2" />
        Choose Your Tour
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="tourSelect" className="block text-sm font-medium text-gray-700 mb-2">
            Tour
          </label>
          <select
            id="tourSelect"
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              hasTourError ? "border-red-300" : "border-gray-300"
            }`}
            value={selectedTour}
            onChange={(e) => {
              setSelectedTour(e.target.value);
              setDepartureDate("");
            }}
          >
            <option value="">Select a tour</option>
            {mergedTours.map((tour) => (
              <option key={tour.title} value={tour.title}>
                {tour.title}
              </option>
            ))}
          </select>
          {hasTourError && <p className="text-red-500 text-xs mt-1">Please select a tour</p>}
        </div>

        <div>
          <label htmlFor="dateSelect" className="block text-sm font-medium text-gray-700 mb-2">
            Departure Date
          </label>
          <div className="relative">
            <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              id="dateSelect"
              className={`w-full pl-10 pr-3 py-2 border rounded-lg ${
                hasDepartureError ? "border-red-300" : "border-gray-300"
              }`}
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              disabled={!selectedTour || !hasDates}
            >
              <option value="">
                {selectedTour ? "Select a date" : "Select a tour first"}
              </option>
              {hasDates &&
                selectedTourData!.dates.map((d) => (
                  <option key={d} value={d}>
                    {formatDisplayDate(d)}
                  </option>
                ))}
            </select>
          </div>
          {hasDepartureError && (
            <p className="text-red-500 text-xs mt-1">Departure date is required</p>
          )}
          {selectedTourData && !hasDates && (
            <p className="text-red-500 text-xs mt-1">
              No departure date available for this tour. Contact support.
            </p>
          )}
        </div>
      </div>

      {selectedTourData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Tour Details</h4>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Title:</span> {selectedTourData.title}
            </p>
            {selectedTourData.name && selectedTourData.name !== selectedTourData.title && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Name:</span> {selectedTourData.name}
              </p>
            )}
            {selectedTourData.description && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Description:</span> {selectedTourData.description}
              </p>
            )}
            {selectedTourData.hotels && selectedTourData.hotels.length > 0 && (
              <div className="text-sm text-gray-600">
                <div className="flex items-center">
                  <Hotel className="w-4 h-4 mr-1" />
                  <span className="font-medium">Hotels:</span>
                </div>
                <ul className="ml-5 list-disc">
                  {selectedTourData.hotels.map((hotel, index) => (
                    <li key={index} className="text-sm text-gray-600">{hotel}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedTourData.services && selectedTourData.services.length > 0 && (
              <div className="text-sm text-gray-600">
                <div className="flex items-center">
                  <Package className="w-4 h-4 mr-1" />
                  <span className="font-medium">Services:</span>
                </div>
                <ul className="ml-5 list-disc">
                  {selectedTourData.services.map((service, index) => (
                    <li key={index} className="text-sm text-gray-600">
                      {service.name} (${service.price})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {userRole !== "user" && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tour Availability</h4>
          {tours.map((tour) => (
            <p key={tour.title + tour.dates?.[0]} className="text-sm text-gray-600">
              {tour.title}:{" "}
              {typeof tour.seats === "number" ? `${tour.seats} seats available` : "No seat limit"}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setActiveStep(2)}
          disabled={!selectedTour || !departureDate}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Passengers
        </button>
      </div>
    </div>
  );
}