import { useMemo, useEffect, useState } from "react";
import { MapPin, Calendar, Hotel, Package } from "lucide-react";
import { toast } from "react-toastify";
import { checkSeatLimit } from "../../utils/seatLimitChecks";
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
    ? d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
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
  showAvailableSeats = userRole === "admin" || userRole === "superadmin",
}: TourSelectionUserProps) {
  const [availableSeats, setAvailableSeats] = useState<number | undefined>(
    undefined
  );

  const mergedTours = useMemo(() => {
    const map = new Map<string, Tour & { dates: string[] }>();
    for (const tour of tours) {
      if (!tour.title) {
        console.warn("Tour missing title:", JSON.stringify(tour, null, 2));
        continue;
      }
      const normalizedTitle = tour.title.trim().toLowerCase();
      // Normalize dates to an array
      const tourDates = Array.isArray(tour.dates)
        ? tour.dates
        : typeof tour.dates === "string"
        ? [tour.dates]
        : [];
      // Include departure_date if it exists and isn't already in dates
      const newDates = [...tourDates];
      if (tour.departure_date && !newDates.includes(tour.departure_date)) {
        newDates.push(tour.departure_date);
      }
      if (!map.has(normalizedTitle)) {
        map.set(normalizedTitle, {
          ...tour,
          title: tour.title.trim(),
          dates: newDates,
          seats: tour.seats ?? 0,
        });
      } else {
        const existing = map.get(normalizedTitle)!;
        const additionalDates = Array.isArray(tour.dates)
          ? tour.dates
          : typeof tour.dates === "string"
          ? [tour.dates]
          : [];
        if (
          tour.departure_date &&
          !additionalDates.includes(tour.departure_date)
        ) {
          additionalDates.push(tour.departure_date);
        }
        existing.dates = Array.from(
          new Set([...existing.dates, ...additionalDates])
        );
      }
    }
    const result = Array.from(map.values());
    return result;
  }, [tours]);

  const selectedTourData = useMemo(() => {
    if (!selectedTour) return undefined;
    const tour = mergedTours.find(
      (tour) =>
        tour.title.trim().toLowerCase() === selectedTour.trim().toLowerCase()
    );
    return tour;
  }, [mergedTours, selectedTour]);

  useEffect(() => {
    if (selectedTourData?.id && departureDate) {
      checkSeatLimit(selectedTourData.id, departureDate)
        .then(({ isValid, message, seats }) => {
          setAvailableSeats(seats);
          if (!isValid) {
            toast.error(message);
          }
        })
        .catch((error) => {
          console.error("Error checking seats:", error);
          toast.error("Failed to check seat availability");
          setAvailableSeats(0);
        });
    } else {
      setAvailableSeats(selectedTourData?.seats);
    }
  }, [selectedTourData, departureDate]);

  const hasTourError = errors.some((e) => e.field === "tour");
  const hasDepartureError = errors.some((e) => e.field === "departure");
  const hasDates = (selectedTourData?.dates?.length ?? 0) > 0;

  const handleContinue = async () => {
  
    if (!selectedTour || !departureDate) {
      toast.error("Please select a tour and departure date.");
      return;
    }

    if (!selectedTourData) {
      toast.error("Invalid tour selected");
      return;
    }

    try {
      const seatCheck = await checkSeatLimit(
        selectedTourData.id,
        departureDate
      );
      if (!seatCheck.isValid) {
        toast.error(seatCheck.message);
        return;
      }
      setActiveStep(2);
    } catch (error) {
      console.error("Error in handleContinue:", error);
      toast.error("Failed to validate seat availability");
    }
  };

  return (
    <div className="mono-card p-6">
      <h3 className="mono-title text-lg flex items-center mb-6">
        <MapPin className="w-5 h-5 mr-2" />
        Choose Your Tour
      </h3>

      {mergedTours.length === 0 ? (
        <p className="text-red-500 text-sm mb-4">
          No tours available. Please contact support or try refreshing the page.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label
              htmlFor="tourSelectUser"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Tour
            </label>
            <select
              id="tourSelectUser"
              className={`mono-input ${hasTourError ? "border-red-300" : ""}`}
              value={selectedTour}
              onChange={(e) => {
                const newTour = e.target.value;
                setSelectedTour(newTour);
                if (!newTour) {
                  setDepartureDate("");
                }
              }}
              aria-invalid={hasTourError}
              aria-describedby={hasTourError ? "tour-error" : undefined}
              disabled={mergedTours.length === 0}
            >
              <option value="">Select a tour</option>
              {mergedTours.map((tour, index) => (
                <option key={`${tour.id}-${index}`} value={tour.title}>
                  {tour.title}
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
            <label
              htmlFor="dateSelectUser"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Departure Date
            </label>
            <div className="relative">
              <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                id="dateSelectUser"
                className={`mono-input pl-10 pr-3 ${
                  hasDepartureError ? "border-red-300" : ""
                }`}
                value={departureDate}
                onChange={(e) => {
                  setDepartureDate(e.target.value);
                }}
                disabled={!selectedTour || !hasDates}
                aria-invalid={hasDepartureError}
                aria-describedby={
                  hasDepartureError ? "departure-error" : undefined
                }
              >
                <option value="">
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
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Tour Details
          </h4>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Title:</span>{" "}
              {selectedTourData.title}
            </p>
            {selectedTourData.name &&
              selectedTourData.name !== selectedTourData.title && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Name:</span>{" "}
                  {selectedTourData.name}
                </p>
              )}
            {selectedTourData.description && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Description:</span>{" "}
                {selectedTourData.description}
              </p>
            )}
            {showAvailableSeats && availableSeats !== undefined && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Available Seats:</span>{" "}
                {availableSeats}
              </p>
            )}
            {selectedTourData.base_price !== undefined && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Base Price:</span> $
                {selectedTourData.base_price.toLocaleString()}
              </p>
            )}
            {selectedTourData.hotels &&
              (() => {
                const hotels = Array.isArray(selectedTourData.hotels)
                  ? selectedTourData.hotels
                  : selectedTourData.hotels
                  ? [selectedTourData.hotels]
                  : [];
                if (hotels.length === 0) return null;

                return (
                  <div className="text-sm text-gray-600">
                    <div className="flex items-center">
                      <Hotel className="w-4 h-4 mr-1" />
                      <span className="font-medium">Hotels:</span>
                    </div>
                    <ul className="ml-5 list-disc">
                      {hotels.map((hotel, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          {hotel}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            {selectedTourData.services &&
              selectedTourData.services.length > 0 && (
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
          onClick={handleContinue}
          disabled={!selectedTour || !departureDate || mergedTours.length === 0}
          className="mono-button"
        >
          Continue to Passengers
        </button>
      </div>
    </div>
  );
}
