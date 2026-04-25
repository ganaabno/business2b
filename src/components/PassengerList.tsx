import React, { useEffect, useMemo, useState } from "react";
import { PassengerFormFields } from "../addPassengerComponents/PassengerFormFields";
import type { Passenger, Tour, ValidationError } from "../types/type";
import { supabase } from "../supabaseClient";
import { useTranslation } from "react-i18next";
import i18next from "i18next";

const COLOR_PALETTE = [
  "#ff0000",
  "#8b5cf6",
  "#f59e0b",
  "#84cc16",
  "#00b0ff",
  "#3b82f6",
  "#f43f5e",
  "#10b981",
  "#6366f1",
  "#f97316",
  "#a855f7",
  "#06b6d4",
  "#d946ef",
  "#ec4899",
];

const REQUIRED_PASSENGER_FIELDS: Array<keyof Passenger> = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "nationality",
  "date_of_birth",
  "passport_number",
  "roomType",
  "hotel",
];

const getMissingRequiredFields = (passenger: Passenger): Array<keyof Passenger> => {
  return REQUIRED_PASSENGER_FIELDS.filter((key) => {
    const value = passenger[key] as unknown;

    if (key === "email") {
      return !(typeof value === "string" && /\S+@\S+\.\S+/.test(value.trim()));
    }

    if (typeof value === "string") {
      return value.trim() === "";
    }

    return value === null || value === undefined;
  });
};

interface PassengerListProps {
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  selectedTourData?: Tour;
  errors: ValidationError[];
  updatePassenger: (
    index: number,
    field:
      | keyof Passenger
      | "subPassengerCount"
      | "hasSubPassengers"
      | "is_related_to_next",
    value: any,
  ) => void;
  removePassenger: (index: number) => void;
  expandedPassengerId: string | null;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  fieldLoading: Record<string, boolean>;
  newPassengerRef: React.RefObject<HTMLDivElement | null>;
  nationalities: string[];
  roomTypes: string[];
  hotels: string[];
  setNotification: (notification: { type: string; message: string }) => void;
  addMainPassenger: () => void;
  managerMode?: boolean;
}

const assignGroupColors = (
  passengers: Passenger[],
  usedColorsSet: Set<string>,
): Passenger[] => {
  const takenColors = new Set<string>(usedColorsSet); // Start with DB-used colors
  let carryOverColor: string | null = null;
  let colorIndex = 0;

  const result: Passenger[] = [];

  for (const pax of passengers) {
    if (pax.main_passenger_id) {
      // Sub-passenger → will inherit from main later
      result.push({ ...pax });
      continue;
    }

    // MAIN PASSENGER
    let assignedColor: string;

    if (pax.group_color && usedColorsSet.has(pax.group_color)) {
      // This passenger already has a color from DB → keep it (even if re-editing)
      assignedColor = pax.group_color;
    } else if (carryOverColor) {
      // Linked from previous → reuse
      assignedColor = carryOverColor;
    } else {
      // Pick next AVAILABLE color
      let candidate: string;
      do {
        candidate = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
        colorIndex++;
      } while (takenColors.has(candidate));
      assignedColor = candidate;
    }

    takenColors.add(assignedColor);
    carryOverColor = pax.is_related_to_next ? assignedColor : null;

    result.push({ ...pax, group_color: assignedColor });
  }

  // Apply color to sub-passengers
  return result.map((p) => {
    if (p.main_passenger_id) {
      const main = result.find((m) => m.id === p.main_passenger_id);
      return { ...p, group_color: main?.group_color || null };
    }
    return p;
  });
};

class PassengerListErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-xl">
          {i18next.t("passengerListErrorBoundary")}
        </div>
      );
    }
    return this.props.children;
  }
}

export const PassengerList: React.FC<PassengerListProps> = ({
  passengers,
  setPassengers,
  selectedTourData,
  errors,
  updatePassenger,
  removePassenger,
  expandedPassengerId,
  setExpandedPassengerId,
  fieldLoading,
  newPassengerRef,
  nationalities,
  roomTypes,
  hotels,
  setNotification,
  addMainPassenger,
  managerMode = false,
}) => {
  const { t } = useTranslation();
  const [usedColorsSet, setUsedColorsSet] = useState<Set<string>>(new Set());
  const departureDate = passengers[0]?.departure_date || "";

  const getRequiredFieldLabel = (field: keyof Passenger): string => {
    switch (field) {
      case "first_name":
        return t("firstName");
      case "last_name":
        return t("lastName");
      case "email":
        return t("email");
      case "phone":
        return t("phone");
      case "nationality":
        return t("nationality");
      case "date_of_birth":
        return t("dob");
      case "passport_number":
        return t("passportNumber");
      case "roomType":
        return t("roomType");
      case "hotel":
        return t("hotel");
      default:
        return String(field);
    }
  };

  const formatMissingFieldSummary = (
    missingFields: Array<keyof Passenger>,
    limit = 3,
  ): string => {
    const labels = missingFields.slice(0, limit).map(getRequiredFieldLabel);
    const remainingCount = Math.max(0, missingFields.length - labels.length);

    if (remainingCount > 0) {
      return `${labels.join(", ")} ${t("managerPlusMore", {
        count: remainingCount,
      })}`;
    }

    return labels.join(", ");
  };

  const incompletePassengerIndices = useMemo(
    () =>
      passengers
        .map((passenger, index) => ({
          index,
          missingFields: getMissingRequiredFields(passenger),
        }))
        .filter((entry) => entry.missingFields.length > 0),
    [passengers],
  );

  useEffect(() => {
    if (!managerMode || passengers.length === 0 || expandedPassengerId) {
      return;
    }

    const firstIncomplete = passengers.find(
      (passenger) => getMissingRequiredFields(passenger).length > 0,
    );

    setExpandedPassengerId(firstIncomplete?.id || passengers[0].id);
  }, [managerMode, passengers, expandedPassengerId, setExpandedPassengerId]);

  const focusNextIncomplete = () => {
    if (incompletePassengerIndices.length === 0) {
      return;
    }

    const currentIndex = passengers.findIndex(
      (passenger) => passenger.id === expandedPassengerId,
    );

    const nextIncomplete =
      incompletePassengerIndices.find((entry) => entry.index > currentIndex) ||
      incompletePassengerIndices[0];

    if (nextIncomplete) {
      setExpandedPassengerId(passengers[nextIncomplete.index]?.id || null);
    }
  };

  // Fetch used colors ONLY when tour or departure changes (optimized to prevent fetches on every passenger update)
  useEffect(() => {
    if (!selectedTourData?.id || !departureDate) {
      setUsedColorsSet(new Set());
      return;
    }

    let isMounted = true;

    const fetchUsedColors = async () => {
      const { data, error } = await supabase
        .from("passengers")
        .select("group_color")
        .eq("tour_id", selectedTourData.id)
        .eq("departure_date", departureDate)
        .neq("group_color", null);

      if (error) {
        console.error("Failed to fetch used colors:", error);
        return;
      }

      if (isMounted) {
        setUsedColorsSet(
          new Set(
            (data || []).map((p) => p.group_color).filter(Boolean) as string[],
          ),
        );
      }
    };

    fetchUsedColors();

    return () => {
      isMounted = false;
    };
  }, [selectedTourData?.id, departureDate]);

  // Assign colors when passengers or used colors change (now sync and fast)
  useEffect(() => {
    // Early return if no tour or no passengers
    if (!selectedTourData?.id || passengers.length === 0) {
      setPassengers((prev) => prev.map((p) => ({ ...p, group_color: null })));
      return;
    }

    // Extract departureDate early so we can use it in deps and logic
    const departureDate = passengers[0]?.departure_date;

    if (!departureDate) {
      return;
    }

    const updatedPassengers = assignGroupColors(passengers, usedColorsSet);

    // Only update state if colors actually changed — prevents infinite loop
    setPassengers((prev) => {
      for (let i = 0; i < updatedPassengers.length; i++) {
        const newColor = updatedPassengers[i].group_color;
        const oldColor = prev[i]?.group_color ?? null;
        if (newColor !== oldColor) {
          return updatedPassengers; // Yes, colors changed → update
        }
      }
      return prev; // No changes → return old array (no re-render)
    });
  }, [
    selectedTourData?.id,
    passengers.length,
    // This key changes only when relevant grouping structure changes
    passengers
      .map(
        (p) =>
          `${p.id || "temp"}-${p.is_related_to_next ?? false}-${
            p.group_color || ""
          }-${p.main_passenger_id || ""}`,
      )
      .join("|"),
    // departureDate as direct dependency (now declared in scope)
    passengers[0]?.departure_date,
    setPassengers, // stable
    usedColorsSet, // Add this to trigger when used colors are fetched
  ]);

  return (
    <PassengerListErrorBoundary>
      <div className="space-y-6">
        {managerMode && (
          <div className="mono-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {incompletePassengerIndices.length === 0
                  ? t("managerAllPassengersComplete")
                  : t("managerPassengersNeedRequiredFields", {
                      count: incompletePassengerIndices.length,
                    })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {t("managerRequiredFieldsHint")}
              </p>
            </div>

            <button
              type="button"
              className="mono-button mono-button--ghost mono-button--sm"
              onClick={focusNextIncomplete}
              disabled={incompletePassengerIndices.length === 0}
            >
              {t("managerFocusNextIncomplete")}
            </button>
          </div>
        )}

        {passengers.map((passenger, index) => {
          const isExpanded = expandedPassengerId === passenger.id;
          const isMain = !passenger.main_passenger_id;
          const missingRequiredFields = getMissingRequiredFields(passenger);

          return (
            <div
              key={`${passenger.id}-${index}-${
                passenger.main_passenger_id || "main"
              }`}
              ref={index === passengers.length - 1 ? newPassengerRef : null}
              className={`${
                managerMode
                  ? `mono-card border overflow-hidden transition-all duration-200 ${
                      isExpanded
                        ? "ring-2 ring-gray-900 shadow-md"
                        : "hover:border-gray-300"
                    }`
                  : `border-2 rounded-xl overflow-hidden transition-all duration-300 ${
                      isExpanded
                        ? "ring-4 ring-blue-400 shadow-2xl"
                        : "hover:shadow-lg"
                    }`
              } ${
                passenger.main_passenger_id ? "ml-12 border-l-8" : "border-l-8"
              }
                ${passenger.group_color ? "" : "border-l-gray-300"}
              `}
              style={{
                borderLeftColor: passenger.group_color || "#e5e7eb",
              }}
            >
              {/* HEADER — always visible, cheap */}
              <div
                className="px-6 py-4 border-b cursor-pointer select-none"
                onClick={() =>
                  setExpandedPassengerId(isExpanded ? null : passenger.id)
                }
                style={{
                  background: passenger.group_color
                    ? managerMode
                      ? `${passenger.group_color}12`
                      : `linear-gradient(to right, ${passenger.group_color}22, transparent)`
                    : "linear-gradient(to right, #f3f4f6, transparent)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Color dot */}
                    {passenger.group_color && (
                      <div
                        className="w-10 h-10 rounded-full ring-4 ring-white shadow-lg"
                        style={{ backgroundColor: passenger.group_color }}
                      />
                    )}

                    {/* Serial number */}
                    <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full shadow">
                      <span className="text-lg font-bold text-gray-700">
                        {passenger.serial_no || index + 1}
                      </span>
                    </div>

                    {/* Name / Placeholder */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">
                        {passenger.first_name || passenger.last_name
                          ? `${passenger.first_name || ""} ${
                              passenger.last_name || ""
                            }`.trim()
                          : t("managerNewPassenger")}
                        {passenger.main_passenger_id && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            ({t("managerSubPassenger")})
                          </span>
                        )}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {passenger.email || t("managerClickToFillDetails")} •{" "}
                        {passenger.nationality || "—"}
                      </p>

                      {managerMode && (
                        <p className="text-xs text-gray-500 mt-1">
                          {missingRequiredFields.length === 0
                            ? t("managerRequiredFieldsComplete")
                            : `${t("managerMissingPrefix")}: ${formatMissingFieldSummary(
                                missingRequiredFields,
                              )}`}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ACTIONS — stop propagation so they don't toggle expand */}
                  <div
                    className="flex items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Room Type Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        passenger.roomType?.includes("Single") ||
                        passenger.roomType?.includes("King")
                          ? "bg-green-100 text-green-800"
                          : passenger.roomType?.includes("Double") ||
                              passenger.roomType?.includes("Twin")
                            ? "bg-blue-100 text-blue-800"
                            : passenger.roomType?.includes("Family")
                              ? "bg-purple-100 text-purple-800"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {passenger.roomType || t("managerNoRoom")}
                    </span>

                    {managerMode && (
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          missingRequiredFields.length === 0
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {missingRequiredFields.length === 0
                          ? t("managerStatusComplete")
                          : t("managerStatusMissing", {
                              count: missingRequiredFields.length,
                            })}
                      </span>
                    )}

                    {/* Link to next (main only) */}
                    {isMain && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={passenger.is_related_to_next || false}
                          onChange={(e) =>
                            updatePassenger(
                              index,
                              "is_related_to_next",
                              e.target.checked,
                            )
                          }
                          className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 focus:ring-2"
                        />
                        <span className="text-sm font-bold text-purple-700 whitespace-nowrap">
                          {passenger.is_related_to_next
                            ? t("managerLinked")
                            : t("managerLinkNext")}
                        </span>
                      </label>
                    )}

                    {/* Expand/Collapse Arrow — now clickable too */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPassengerId(
                          isExpanded ? null : passenger.id,
                        );
                      }}
                      className="p-2 rounded-lg transition-all"
                    >
                      <svg
                        className={`w-6 h-6 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePassenger(index);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* LAZY FORM — only render when expanded */}
              {isExpanded && (
                <div className="p-6 bg-gray-50 animate-fadeIn">
                  <PassengerFormFields
                    passenger={passenger}
                    index={index}
                    selectedTourData={selectedTourData}
                    passengers={passengers}
                    errors={errors}
                    updatePassenger={updatePassenger}
                    expanded={true}
                    fieldLoading={fieldLoading}
                    nationalities={nationalities}
                    roomTypes={roomTypes}
                    hotels={hotels}
                    setNotification={setNotification}
                    managerMode={managerMode}
                    departureDate={
                      passenger.departure_date ||
                      selectedTourData?.departure_date ||
                      ""
                    }
                  />
                </div>
              )}

              {/* Optional: Show placeholder when collapsed */}
              {!isExpanded && (
                <div className="px-6 py-4 bg-gray-50 text-center text-gray-500 text-sm">
                  {managerMode
                    ? missingRequiredFields.length === 0
                      ? t("managerReadyToReview")
                      : `${t("managerMissingRequiredFieldsPrefix")}: ${formatMissingFieldSummary(
                          missingRequiredFields,
                        )}`
                    : t("managerClickToEditPassenger")}
                </div>
              )}
            </div>
          );
        })}

        {/* Add button */}
        <div className="flex mt-8 justify-end">
          <button
            onClick={addMainPassenger}
            className={
              managerMode
                ? "mono-button"
                : "px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            }
          >
            {t("passengerListAddMainPassenger")}
          </button>
        </div>
      </div>
    </PassengerListErrorBoundary>
  );
};
