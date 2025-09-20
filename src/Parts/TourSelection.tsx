import { useMemo, useEffect } from "react";
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
  showAvailableSeats?: boolean;
}

function formatDisplayDate(s: string | undefined): string {
  if (!s) return "N/A";
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
  showAvailableSeats = true,
}: TourSelectionProps) {
  const mergedTours = useMemo(() => {
    const map = new Map<string, Tour & { dates: string[] }>();
    for (const tour of tours) {
      if (!tour.title) {
        console.warn("Tour missing title:", tour);
        continue;
      }
      const normalizedTitle = tour.title.trim().toLowerCase();
      if (!map.has(normalizedTitle)) {
        map.set(normalizedTitle, {
          ...tour,
          title: tour.title.trim(),
          dates: [...(tour.dates || [])],
          available_seats: tour.available_seats ?? tour.seats ?? 0, // Fallback to seats
        });
      } else {
        const existing = map.get(normalizedTitle)!;
        existing.dates = Array.from(new Set([...existing.dates, ...(tour.dates || [])]));
        // Use the maximum available_seats or seats to avoid incorrect merging
        existing.available_seats = Math.max(
          existing.available_seats ?? 0,
          tour.available_seats ?? tour.seats ?? 0
        );
      }
    }
    const result = Array.from(map.values());
    console.log("Merged tours:", result.map(t => ({
      id: t.id,
      title: t.title,
      seats: t.seats,
      available_seats: t.available_seats,
      dates: t.dates,
    })));
    return result;
  }, [tours]);

  useEffect(() => {
    console.log("TourSelection rendered with props:", {
      selectedTour,
      departureDate,
      tours: tours.map(t => ({
        id: t.id,
        title: t.title,
        seats: t.seats,
        available_seats: t.available_seats,
      })),
    });
    console.log("Merged tours titles and seats:", mergedTours.map(tour => ({
      title: tour.title,
      seats: tour.seats,
      available_seats: tour.available_seats,
    })));
  }, [tours, selectedTour, departureDate, mergedTours]);

  const selectedTourData = useMemo(() => {
    const tour = mergedTours.find((tour) => tour.title.trim().toLowerCase() === selectedTour.trim().toLowerCase());
    console.log("Selected tour data:", tour ? {
      id: tour.id,
      title: tour.title,
      seats: tour.seats,
      available_seats: tour.available_seats,
      dates: tour.dates,
    } : null);
    return tour;
  }, [mergedTours, selectedTour]);

  const hasTourError = errors.some((e) => e.field === "tour");
  const hasDepartureError = errors.some((e) => e.field === "departure");
  const hasDates = (selectedTourData?.dates?.length ?? 0) > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-6">
        <MapPin className="w-5 h-5 mr-2" />
        Choose Your Tour
      </h3>

      {mergedTours.length === 0 ? (
        <p className="text-red-500 text-sm mb-4">No tours available. Please contact support.</p>
      ) : (
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
                const newTour = e.target.value.trim();
                console.log("Tour selected:", newTour);
                setSelectedTour(newTour);
                setDepartureDate("");
              }}
              aria-invalid={hasTourError}
              aria-describedby={hasTourError ? "tour-error" : undefined}
              disabled={mergedTours.length === 0}
            >
              <option value="" disabled>
                Select a tour
              </option>
              {mergedTours.map((tour, index) => (
                <option key={`${tour.title}-${index}`} value={tour.title}>
                  {tour.title}{" "}
                  {showAvailableSeats
                    ? `(${tour.available_seats ?? tour.seats ?? "No limit"} seats)`
                    : ""}
                </option>
              ))}
            </select>
            {hasTourError && (
              <p id="tour-error" className="text-red-500 text-xs mt-1">
                Please select a tour
              </p>
            )}
          </div>

          <div>
            <label htmlFor="dateSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Departure Date
            </label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                id="dateSelect"
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  hasDepartureError ? "border-red-300" : "border-gray-300"
                }`}
                value={departureDate}
                onChange={(e) => {
                  console.log("Departure date selected:", e.target.value);
                  setDepartureDate(e.target.value);
                }}
                disabled={!selectedTour || !hasDates}
                aria-invalid={hasDepartureError}
                aria-describedby={hasDepartureError ? "departure-error" : undefined}
              >
                <option value="" disabled>
                  {selectedTour ? "Select a date" : "Select a tour first"}
                </option>
                {hasDates &&
                  selectedTourData!.dates
                    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()) // Sort dates chronologically
                    .map((d, index) => (
                      <option key={`${d}-${index}`} value={d}>
                        {formatDisplayDate(d)}
                      </option>
                    ))}
              </select>
            </div>
            {hasDepartureError && (
              <p id="departure-error" className="text-red-500 text-xs mt-1">
                Departure date is required
              </p>
            )}
            {selectedTour && !hasDates && (
              <p className="text-red-500 text-xs mt-1">
                No departure dates available for this tour. Contact support.
              </p>
            )}
          </div>
        </div>
      )}

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
            {showAvailableSeats && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Available Seats:</span>{" "}
                {selectedTourData.available_seats ?? selectedTourData.seats ?? "No limit"}
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

      <div className="flex justify-end">
        <button
          onClick={() => setActiveStep(2)}
          disabled={!selectedTour || !departureDate || mergedTours.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Passengers
        </button>
      </div>
    </div>
  );
}