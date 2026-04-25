import { useMemo } from "react";
import { MapPin, Calendar, Hotel, Package } from "lucide-react";
import type { Tour, ValidationError } from "../types/type";
import { extractTourDepartureDates } from "../utils/tourDates";
import { useTranslation } from "react-i18next";

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

function formatDisplayDate(
  value: string | undefined,
  locale: string,
  invalidLabel: string,
): string {
  if (!value) return invalidLabel;

  const parts = value.split("-");
  const hasIsoDateParts =
    parts.length === 3 &&
    parts.every((part) => /^\d+$/.test(part)) &&
    parts[0].length === 4;

  const d = hasIsoDateParts
    ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    : new Date(value);

  return !Number.isNaN(d.getTime())
    ? d.toLocaleDateString(locale || "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : invalidLabel;
}

function getTourSourceClasses(sourceTag?: Tour["source_tag"]) {
  if (sourceTag === "global") {
    return "bg-emerald-100 text-emerald-700 border-emerald-200";
  }
  if (sourceTag === "global+local") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }
  return "bg-gray-100 text-gray-700 border-gray-200";
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
  const { t, i18n } = useTranslation();

  const getTourSourceLabel = (sourceTag?: Tour["source_tag"]) => {
    if (sourceTag === "global") return t("tourSelectionSourceGlobal");
    if (sourceTag === "global+local") return t("tourSelectionSourceGlobalLocal");
    return t("tourSelectionSourceLocal");
  };

  const globalOnlyToursCount = useMemo(
    () => tours.filter((tour) => (tour.source_tag ?? "local") === "global").length,
    [tours],
  );

  const mergedTours = useMemo(() => {
    const map = new Map<string, Tour & { dateSeats: Record<string, number> }>();

    for (const tour of tours) {
      if (!tour.title || tour.status === "inactive" || tour.status === "full")
        continue;

      const key = tour.title.trim().toLowerCase();

      // === Normalize dates ===
      const tourDates = extractTourDepartureDates(tour);

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
          new Set([...existingHotels, ...tourHotels]),
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
          {t("tourSelectionTitle")}
        </h3>
        <div className="text-center py-8">
          <p className="text-gray-500 text-lg">{t("tourSelectionNoToursTitle")}</p>
          <p className="text-sm text-gray-400 mt-2">
            {t("tourSelectionNoToursSubtitle")}
          </p>
          {globalOnlyToursCount > 0 && (
            <p className="text-sm text-emerald-700 mt-2">
              {t("tourSelectionGlobalOnlyHint", { count: globalOnlyToursCount })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mono-card p-6">
      <h3 className="mono-title text-lg flex items-center mb-6">
        <MapPin className="w-5 h-5 mr-2" />
        {t("tourSelectionTitle")}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label
            htmlFor="tourSelect"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("tour")}
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
              {t("tourSelectionSelectTourPlaceholder")}
            </option>
            {mergedTours.map((tour) => (
              <option key={tour.id} value={tour.title}>
                {tour.title} [{getTourSourceLabel(tour.source_tag)}]
              </option>
            ))}
          </select>
          {hasTourError && (
            <p className="text-red-500 text-xs mt-1">{t("tourSelectionSelectTourError")}</p>
          )}
          {selectedTourData && (
            <div className="mt-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getTourSourceClasses(
                  selectedTourData.source_tag,
                )}`}
              >
                {t("source")}: {getTourSourceLabel(selectedTourData.source_tag)}
              </span>
            </div>
          )}
          {globalOnlyToursCount > 0 && (
            <p className="text-emerald-700 text-xs mt-2">
              {t("tourSelectionGlobalAutoSyncHint", {
                count: globalOnlyToursCount,
              })}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="dateSelect"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t("departureDate")}
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
                {selectedTour
                  ? t("tourSelectionSelectDatePlaceholder")
                  : t("tourSelectionSelectTourFirstPlaceholder")}
              </option>
              {selectedTourData?.dates &&
                selectedTourData.dates.length > 0 &&
                selectedTourData.dates
                  .sort((a, b) => a.localeCompare(b))
                  .map((d) => {
                    const availableSeats =
                      selectedTourData!.dateSeats?.[d] ??
                      selectedTourData!.seats ??
                      t("tourSelectionNoLimit");

                    return (
                      <option key={d} value={d}>
                        {formatDisplayDate(
                          d,
                          i18n.resolvedLanguage || "en-US",
                          t("invalidDate"),
                        )}
                        {showAvailableSeats &&
                          ` (${t("tourSelectionSeatsSuffix", {
                            count: availableSeats,
                          })})`}
                      </option>
                    );
                  })}
            </select>
          </div>
          {hasDepartureError && (
            <p className="text-red-500 text-xs mt-1">
              {t("tourSelectionDepartureRequired")}
            </p>
          )}
          {selectedTour && !hasDates && (
            <p className="text-yellow-500 text-xs mt-1">
              {t("tourSelectionNoValidDatesForTour", { tour: selectedTour })}
            </p>
          )}
        </div>
      </div>

      {selectedTourData && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            {t("tourSelectionDetailsTitle")}
          </h4>
          <div className="space-y-2">
            <p>
              <span className="font-medium">{t("tourSelectionFieldTitle")}:</span>{" "}
              {selectedTourData.title}
            </p>
            <p>
              <span className="font-medium">{t("tourSelectionFieldSource")}:</span>{" "}
              {getTourSourceLabel(selectedTourData.source_tag)}
            </p>
            {selectedTourData.name &&
              selectedTourData.name !== selectedTourData.title && (
                <p>
                  <span className="font-medium">{t("tourSelectionFieldName")}:</span>{" "}
                  {selectedTourData.name}
                </p>
              )}
            {selectedTourData.description && (
              <p>
                <span className="font-medium">{t("tourSelectionFieldDescription")}:</span>{" "}
                {selectedTourData.description}
              </p>
            )}
            {showAvailableSeats && (
              <p>
                <span className="font-medium">{t("tourSelectionFieldAvailableSeats")}:</span>{" "}
                {t("tourSelectionAvailableSeatsVariesByDate")}
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
                      .filter(Boolean),
                  );
                } else if (typeof selectedTourData.hotels === "string") {
                  hotels.push(
                    ...selectedTourData.hotels
                      .split(",")
                      .map((h) => h.trim())
                      .filter(Boolean),
                  );
                }
              }
              return hotels.length > 0 ? (
                <div className="text-sm">
                  <div className="flex items-center mb-1">
                    <Hotel className="w-4 h-4 mr-1" />
                    <span className="font-medium">{t("managerHotelsLabel")}:</span>
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
                  <span className="font-medium">{t("managerServicesLabel")}:</span>
                </div>
                <ul className="ml-5 list-disc space-y-1">
                  {selectedTourData.services.map((service, i) => (
                    <li key={i}>
                      {service.name} ({t("price")}: ${service.price})
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
          {t("tourSelectionContinueToPassengers")}
        </button>
      </div>
    </div>
  );
}
