import { useMemo, useEffect } from "react";
import { MapPin, Calendar, Hotel, Package } from "lucide-react";
import type { Tour, ValidationError } from "../../types/type";

interface TourSelectionUserProps {
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
  if (!s) return "";
  const d = new Date(s);
  return !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : s;
}

export default function TourSelectionUser({
  tours,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  errors,
  setActiveStep,
  userRole,
  showAvailableSeats = true,
}: TourSelectionUserProps) {
  useEffect(() => {
    console.log("TourSelectionUser mounted, setSelectedTour:", setSelectedTour);
    return () => console.log("TourSelectionUser unmounted");
  }, [setSelectedTour]);

  const mergedTours = useMemo(() => {
    const map = new Map<string, Tour & { dates: string[] }>();
    for (const tour of tours) {
      if (!tour.title) {
        console.warn("Tour missing title:", JSON.stringify(tour, null, 2));
        continue;
      }
      const normalizedTitle = tour.title.trim().toLowerCase();
      if (!map.has(normalizedTitle)) {
        map.set(normalizedTitle, {
          ...tour,
          title: tour.title.trim(),
          dates: [...(tour.dates || [])],
          seats: tour.seats ?? tour.available_seats ?? 0,
          available_seats: tour.available_seats ?? tour.seats ?? 0,
        });
      } else {
        const existing = map.get(normalizedTitle)!;
        existing.dates = Array.from(new Set([...existing.dates, ...(tour.dates || [])]));
      }
    }
    const result = Array.from(map.values());
    console.log("Merged tours in TourSelectionUser:", JSON.stringify(result, null, 2));
    return result;
  }, [tours]);

  useEffect(() => {
    console.log("Tours received in TourSelectionUser:", JSON.stringify(tours, null, 2));
    console.log("Current selectedTour:", selectedTour);
    console.log("Merged tours titles:", mergedTours.map(tour => tour.title));
    if (
      selectedTour &&
      !mergedTours.some(tour => tour.title.trim().toLowerCase() === selectedTour.trim().toLowerCase())
    ) {
      console.warn("Selected tour not found in mergedTours, resetting:", selectedTour);
      setSelectedTour("");
      setDepartureDate("");
    }
  }, [tours, selectedTour, mergedTours, setSelectedTour, setDepartureDate]);

  const selectedTourData = useMemo(() => {
    console.log("Searching for tour with title:", JSON.stringify(selectedTour));
    const tour = mergedTours.find((tour) => {
      const tourTitle = tour.title.trim().toLowerCase();
      const selectedTitle = selectedTour.trim().toLowerCase();
      const matches = tourTitle === selectedTitle;
      console.log(`Comparing: ${tourTitle} === ${selectedTitle} -> ${matches}`);
      return matches;
    });
    console.log("Selected tour data in TourSelectionUser:", JSON.stringify(tour, null, 2));
    return tour;
  }, [mergedTours, selectedTour]);

  const hasTourError = errors.some((e) => e.field === "tour");
  const hasDepartureError = errors.some((e) => e.field === "departure");
  const hasDates = (selectedTourData?.dates?.length ?? 0) > 0;

  console.log("Rendering tour select with value:", selectedTour, "disabled:", mergedTours.length === 0);

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
            <label htmlFor="tourSelectUser" className="block text-sm font-medium text-gray-700 mb-2">
              Tour
            </label>
            <select
              id="tourSelectUser"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${hasTourError ? "border-red-300" : "border-gray-300"}`}
              value={selectedTour}
              onChange={(e) => {
                const newTour = e.target.value.trim();
                console.log("Tour selected in TourSelectionUser:", newTour);
                setSelectedTour(newTour);
                setDepartureDate("");
                console.log("After setSelectedTour, newTour:", newTour);
              }}
              onClick={() => console.log("Tour dropdown clicked")}
              aria-invalid={hasTourError}
              aria-describedby={hasTourError ? "tour-error" : undefined}
              disabled={mergedTours.length === 0}
            >
              <option value="" disabled>
                Select a tour
              </option>
              {mergedTours.map((tour, index) => (
                <option key={`${tour.id}-${index}`} value={tour.title}>
                  {tour.title}{" "}
                  {showAvailableSeats && (tour.available_seats ?? tour.seats) !== undefined
                    ? `(${(tour.available_seats ?? tour.seats)!} seats)`
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
            <label htmlFor="dateSelectUser" className="block text-sm font-medium text-gray-700 mb-2">
              Departure Date
            </label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                id="dateSelectUser"
                className={`w-full pl-10 pr-3 py-2 border rounded-lg ${hasDepartureError ? "border-red-300" : "border-gray-300"}`}
                value={departureDate}
                onChange={(e) => {
                  console.log("Departure date selected in TourSelectionUser:", e.target.value);
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
                  selectedTourData!.dates.map((d, index) => (
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
            {showAvailableSeats && (selectedTourData.available_seats ?? selectedTourData.seats) !== undefined && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Available Seats:</span>{" "}
                {(selectedTourData.available_seats ?? selectedTourData.seats)!}
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

      {userRole !== "user" && mergedTours.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Tour Availability</h4>
          {mergedTours.map((tour, index) => (
            <p key={`${tour.id}-${index}`} className="text-sm text-gray-600">
              {tour.title}:{" "}
              {typeof (tour.available_seats ?? tour.seats) === "number"
                ? `${(tour.available_seats ?? tour.seats)!} seats available`
                : "No seat limit"}
            </p>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => {
            console.log("Continue to Passengers clicked, selectedTour:", selectedTour, "departureDate:", departureDate);
            setActiveStep(2);
          }}
          disabled={!selectedTour || !departureDate || mergedTours.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue to Passengers
        </button>
      </div>
    </div>
  );
}