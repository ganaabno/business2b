import { useMemo, useEffect } from "react";
import { MapPin, Calendar, Hotel, Package } from "lucide-react";
import type { Tour, ValidationError } from "../types/type";

interface TourSelectionProps {
  tours: Tour[];
  selectedTour: string;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  departure_date: string;
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
    ? d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Invalid date";
}

export default function TourSelection({
  tours,
  selectedTour,
  setSelectedTour,
  departure_date,
  setDepartureDate,
  errors,
  setActiveStep,
  showAvailableSeats = true,
}: TourSelectionProps) {
  const mergedTours = useMemo(() => {
    const map = new Map<string, Tour & { dateSeats: Record<string, number> }>();

    for (const tour of tours) {
      if (!tour.title || tour.status === "inactive" || tour.status === "full")
        continue;

      const key = tour.title.trim().toLowerCase();

      // === Normalize dates ===
      let tourDates: string[] = [];

      // 1. From dates array (preferred)
      if (tour.dates && Array.isArray(tour.dates)) {
        tourDates = tour.dates
          .filter((d): d is string => typeof d === "string" && d.trim() !== "")
          .map((d) => d.split("T")[0]); // normalize
      }

      // 2. Fallback to departure_date if no dates
      if (tourDates.length === 0 && tour.departure_date) {
        const date = tour.departure_date.split("T")[0];
        if (date) tourDates = [date];
      }
      if (tourDates.length === 0 && tour.departure_date) {
        tourDates = [tour.departure_date];
      }

      // === Normalize hotels to string[] ===
      let tourHotels: string[] = [];
      if (tour.hotels) {
        if (Array.isArray(tour.hotels)) {
          tourHotels = tour.hotels
            .filter((h): h is string => typeof h === "string")
            .map((h) => h.trim())
            .filter(Boolean);
        } else if (typeof tour.hotels === "string") {
          tourHotels = tour.hotels
            .split(",")
            .map((h) => h.trim())
            .filter(Boolean);
        }
      }

      const seatsToUse = tour.available_seats ?? tour.seats ?? 0;

      if (!map.has(key)) {
        const newTour = {
          ...tour,
          title: tour.title.trim(),
          dates: tourDates,
          hotels: tourHotels,
          dateSeats: {} as Record<string, number>,
        };
        for (const d of tourDates) {
          newTour.dateSeats[d] = seatsToUse;
        }
        map.set(key, newTour);
      } else {
        const existing = map.get(key)!;

        // === SAFELY MERGE DATES ===
        existing.dates = Array.from(new Set([...existing.dates, ...tourDates]));

        // === SAFELY MERGE HOTELS (this is the fix!) ===
        const existingHotels: string[] = Array.isArray(existing.hotels)
          ? existing.hotels
              .filter((h): h is string => typeof h === "string")
              .map((h) => h.trim())
              .filter(Boolean)
          : typeof existing.hotels === "string"
          ? existing.hotels
              .split(",")
              .map((h) => h.trim())
              .filter(Boolean)
          : [];

        existing.hotels = Array.from(
          new Set([...existingHotels, ...tourHotels])
        );

        // === MERGE SEATS BY DATE ===
        for (const d of tourDates) {
          if (!(d in existing.dateSeats)) {
            existing.dateSeats[d] = seatsToUse;
          } else {
            existing.dateSeats[d] = Math.max(existing.dateSeats[d], seatsToUse);
          }
        }
      }
    }

    return Array.from(map.values());
  }, [tours]);

  const selectedTourData = useMemo(() => {
    if (!selectedTour) return null;
    const normalized = selectedTour.trim().toLowerCase();
    return (
      mergedTours.find((t) => t.title.trim().toLowerCase() === normalized) ??
      null
    );
  }, [mergedTours, selectedTour]);

  const hasTourError = errors.some((e) => e.field === "tour");
  const hasDepartureError = errors.some((e) => e.field === "departure");
  const hasDates = selectedTourData?.dates && selectedTourData.dates.length > 0;

  if (mergedTours.length === 0) {
    return (
      <div className="mono-card p-6">
        <h3 className="mono-title text-lg flex items-center mb-6">
          <MapPin className="w-5 h-5 mr-2" />
          Choose Your Tour
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500 text-lg">No tours available right now.</p>
          <p className="text-sm text-gray-400 mt-2">
            All tours are either inactive, full, or not showing. Check back
            later!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mono-card p-6">
      <h3 className="mono-title text-lg flex items-center mb-6">
        <MapPin className="w-5 h-5 mr-2" />
        Choose Your Tour
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label
            htmlFor="tourSelect"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Tour
          </label>
          <select
            id="tourSelect"
            className={`mono-input ${hasTourError ? "border-red-300" : ""}`}
            value={selectedTour}
            onChange={(e) => {
              const value = e.target.value.trim();
              setSelectedTour(value);
              setDepartureDate("");
            }}
          >
            <option value="" disabled>
              Select a tour
            </option>
            {mergedTours.map((tour) => (
              <option key={tour.id} value={tour.title}>
                {tour.title}
              </option>
            ))}
          </select>
          {hasTourError && (
            <p className="text-red-500 text-xs mt-1">Please select a tour</p>
          )}
        </div>

        <div>
          <label
            htmlFor="dateSelect"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Departure Date
          </label>
          <div className="relative">
            <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              id="dateSelect"
              className={`mono-input pl-10 pr-3 ${
                hasDepartureError ? "border-red-300" : ""
              }`}
              value={departure_date}
              onChange={(e) => setDepartureDate(e.target.value)}
              disabled={!selectedTour || !hasDates}
            >
              <option value="" disabled>
                {selectedTour ? "Select a date" : "Select a tour first"}
              </option>
              {selectedTourData?.dates &&
                selectedTourData.dates.length > 0 &&
                selectedTourData.dates
                  .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                  .map((d) => {
                    const availableSeats =
                      selectedTourData!.dateSeats?.[d] ??
                      selectedTourData!.seats ??
                      "No limit";

                    return (
                      <option key={d} value={d}>
                        {formatDisplayDate(d)}
                        {showAvailableSeats && ` (${availableSeats} seats)`}
                      </option>
                    );
                  })}
            </select>
          </div>
          {hasDepartureError && (
            <p className="text-red-500 text-xs mt-1">
              Departure date is required
            </p>
          )}
          {selectedTour && !hasDates && (
            <p className="text-yellow-500 text-xs mt-1">
              No valid departure dates for "{selectedTour}". Try another tour.
            </p>
          )}
        </div>
      </div>

      {selectedTourData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Tour Details
          </h4>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Title:</span>{" "}
              {selectedTourData.title}
            </p>
            {selectedTourData.name &&
              selectedTourData.name !== selectedTourData.title && (
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {selectedTourData.name}
                </p>
              )}
            {selectedTourData.description && (
              <p>
                <span className="font-medium">Description:</span>{" "}
                {selectedTourData.description}
              </p>
            )}
            {showAvailableSeats && (
              <p>
                <span className="font-medium">Available Seats:</span> Varies by
                date
              </p>
            )}

            {/* HOTELS: TYPE-SAFE RENDER */}
            {(() => {
              const hotels: string[] = [];
              if (selectedTourData.hotels) {
                if (Array.isArray(selectedTourData.hotels)) {
                  hotels.push(
                    ...selectedTourData.hotels
                      .filter((h): h is string => typeof h === "string")
                      .map((h) => h.trim())
                      .filter(Boolean)
                  );
                } else if (typeof selectedTourData.hotels === "string") {
                  hotels.push(
                    ...selectedTourData.hotels
                      .split(",")
                      .map((h) => h.trim())
                      .filter(Boolean)
                  );
                }
              }
              return hotels.length > 0 ? (
                <div className="text-sm">
                  <div className="flex items-center mb-1">
                    <Hotel className="w-4 h-4 mr-1" />
                    <span className="font-medium">Hotels:</span>
                  </div>
                  <ul className="ml-5 list-disc space-y-1">
                    {hotels.map((hotel, i) => (
                      <li key={i}>{hotel}</li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            {/* SERVICES */}
            {selectedTourData.services?.length > 0 && (
              <div className="text-sm">
                <div className="flex items-center mb-1">
                  <Package className="w-4 h-4 mr-1" />
                  <span className="font-medium">Services:</span>
                </div>
                <ul className="ml-5 list-disc space-y-1">
                  {selectedTourData.services.map((service, i) => (
                    <li key={i}>
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
          disabled={!selectedTour || !departure_date || !hasDates}
          className="mono-button"
        >
          Continue to Passengers
        </button>
      </div>
    </div>
  );
}
