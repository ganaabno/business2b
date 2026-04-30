import React, { useState, useMemo, memo } from "react";
import { parse, isValid, format } from "date-fns";
import { useDebouncedCallback } from "use-debounce";
import {
  BedDouble,
  Contact,
  FileText,
  IdCard,
  Sparkles,
  UserRound,
  VenetianMask,
} from "lucide-react";
import type { Passenger, Tour } from "../types/type";
import { supabase } from "../supabaseClient";
import { calculateAge } from "../utils/tourUtils";
import { useTranslation } from "react-i18next";

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

type SectionHeaderProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
};

function SectionHeader({ icon: Icon, title, hint }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-0.5">
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 text-gray-500" />
        <h4 className="text-[10px] font-medium text-gray-900 uppercase tracking-wide">{title}</h4>
      </div>

      {hint ? <span className="text-[9px] text-gray-500">{hint}</span> : null}
    </div>
  );
}

interface PassengerFormFieldsProps {
  passenger: Passenger;
  index: number;
  selectedTourData?: Tour;
  passengers: Passenger[] | undefined;
  errors: any[];
  updatePassenger: (
    index: number,
    field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
    value: any,
  ) => void;
  expanded: boolean;
  fieldLoading: Record<string, boolean>;
  nationalities: string[];
  roomTypes: string[];
  hotels: string[];
  setNotification: (notification: { type: string; message: string }) => void;
  departureDate: string;
  managerMode?: boolean;
}

export const PassengerFormFields: React.FC<PassengerFormFieldsProps> = memo(
  ({
    passenger,
    index,
    selectedTourData,
    errors,
    updatePassenger,
    expanded,
    fieldLoading,
    nationalities,
    roomTypes,
    hotels,
    setNotification,
    managerMode = false,
  }) => {
    const { t } = useTranslation();
    const [localRoomType, setLocalRoomType] = useState(
      passenger.roomType || "",
    );
    const [uploadLoading, setUploadLoading] = useState(false);

    // Debounce frequent updates (text inputs)
    const debouncedUpdate = useDebouncedCallback(
      (
        field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
        value: any,
      ) => {
        updatePassenger(index, field, value);
      },
    );

    // Immediate updates for checkboxes/selects (low frequency)
    const immediateUpdate = (
      field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
      value: any,
    ) => {
      updatePassenger(index, field, value);
    };

    // Memoized formatted dates
    const formattedDob = useMemo(
      () => formatDate(passenger.date_of_birth),
      [passenger.date_of_birth],
    );
    const formattedExpiry = useMemo(
      () => formatDate(passenger.passport_expire),
      [passenger.passport_expire],
    );

    // Precompute errors for this passenger only
    const passengerErrors = useMemo(() => {
      const prefix = `passenger_${passenger.serial_no}_`;
      return errors.reduce(
        (acc, err) => {
          if (err.field?.startsWith(prefix)) {
            acc[err.field.replace(prefix, "")] = err;
          }
          return acc;
        },
        {} as Record<string, any>,
      );
    }, [errors, passenger.serial_no]);

    const getError = (field: string) => passengerErrors[field];

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
      limit = 5,
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

    const missingRequiredFields = useMemo(
      () => getMissingRequiredFields(passenger),
      [passenger],
    );

    // Calculate age directly (cheap operation)
    const age = passenger.date_of_birth
      ? calculateAge(passenger.date_of_birth)
      : null;

    const getPassportExpiryColor = (expiryDate: string | null): string => {
      if (!expiryDate) return "border-gray-300";
      const expiry = new Date(expiryDate);
      const today = new Date();
      const monthsRemaining =
        (expiry.getFullYear() - today.getFullYear()) * 12 +
        (expiry.getMonth() - today.getMonth());
      if (monthsRemaining <= 0) return "border-red-500 bg-red-50";
      if (monthsRemaining <= 1) return "border-red-400 bg-red-50";
      if (monthsRemaining <= 3) return "border-orange-400 bg-orange-50";
      if (monthsRemaining <= 7) return "border-yellow-400 bg-yellow-50";
      return "border-green-400 bg-green-50";
    };

    function formatDate(dateStr: string | null | undefined): string {
      if (!dateStr) return "";
      const formats = [
        "yyyy-MM-dd",
        "d-MM-yy",
        "dd-MM-yy",
        "M-d-yy",
        "MM-dd-yy",
        "dd/MM/yyyy",
      ];
      for (const fmt of formats) {
        const parsed = parse(dateStr, fmt, new Date());
        if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
      }
      return "";
    }

    const handlePassportUpload = async (
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadLoading(true);
      try {
        const fileExt = file.name.split(".").pop() || "jpg";
        const filePath = `${passenger.id}/passport.${fileExt}`;
        const { data, error } = await supabase.storage
          .from("passport")
          .upload(filePath, file, { contentType: file.type, upsert: true });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from("passport")
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          immediateUpdate("passport_upload", urlData.publicUrl);
          setNotification({
            type: "success",
            message: t("passengerFormPassportUploaded"),
          });
        } else {
          setNotification({
            type: "error",
            message: t("passengerFormPassportUrlFailed"),
          });
        }
      } catch (error: any) {
        setNotification({
          type: "error",
          message: error.message.includes("security")
            ? t("passengerFormPermissionDenied")
            : t("passengerFormUploadFailed", { message: error.message }),
        });
      } finally {
        setUploadLoading(false);
      }
    };

    const handleServiceChange = (serviceName: string, checked: boolean) => {
      const current = passenger.additional_services || [];
      const updated = checked
        ? [...current, serviceName]
        : current.filter((s) => s !== serviceName);
      immediateUpdate("additional_services", updated);
    };

    const handleRoomTypeChange = (roomType: string) => {
      setLocalRoomType(roomType);
      immediateUpdate("roomType", roomType);
    };

    if (!expanded) return null;

    const requiredTotal = REQUIRED_PASSENGER_FIELDS.length;
    const requiredCompleted = requiredTotal - missingRequiredFields.length;
    const completionPercent = Math.round((requiredCompleted / requiredTotal) * 100);
const labelClass =
      "mb-0 block text-[9px] font-medium uppercase tracking-wide text-gray-600";
    const errorClass = "mt-0 text-[9px] text-red-600";
    const inputClass = (hasError: boolean) =>
      `mono-input ${hasError ? "border-red-400" : ""}`;
    const selectClass = (hasError: boolean) =>
      `mono-select ${hasError ? "border-red-400" : ""}`;

    return (
<div className="space-y-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
        <div className="mono-panel p-1.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t("passengerFormProgressLabel")}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {t("passengerFormProgressSummary", {
                  completed: requiredCompleted,
                  total: requiredTotal,
                })}
              </p>
            </div>

            <span
              className={`mono-badge ${
                missingRequiredFields.length === 0
                  ? "mono-badge--success"
                  : "mono-badge--warning"
              }`}
            >
              {missingRequiredFields.length === 0
                ? t("managerStatusComplete")
                : t("managerStatusMissing", {
                    count: missingRequiredFields.length,
                  })}
            </span>
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${
                missingRequiredFields.length === 0
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${completionPercent}%` }}
            />
          </div>

          {managerMode && missingRequiredFields.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {t("managerMissingPrefix")}: {formatMissingFieldSummary(
                missingRequiredFields,
                5,
              )}
            </p>
          )}
        </div>

{!passenger.main_passenger_id && (
          <div className="mono-panel border-blue-200 bg-blue-50/70 p-1.5">
            <div className="flex flex-wrap items-start gap-1">
              <label className="flex items-center gap-1 text-xs font-medium text-gray-900">
                <input
                  type="checkbox"
                  checked={passenger.has_sub_passengers || false}
                  onChange={(e) =>
                    immediateUpdate("hasSubPassengers", e.target.checked)
                  }
                  className="h-3 w-3 rounded border-gray-300"
                />
                {t("passengerFormHasSubPassengers")}
              </label>

              {passenger.has_sub_passengers && (
                <div className="ml-auto grid w-full gap-1 sm:max-w-sm">
                  <label className={labelClass}>
                    {t("passengerFormSubPassengerCount")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={passenger.sub_passenger_count || ""}
                    onChange={(e) =>
                      immediateUpdate(
                        "subPassengerCount",
                        parseInt(e.target.value, 10) || 0,
                      )
                    }
                    className="mono-input"
                    placeholder={t("passengerFormSubPassengerCountPlaceholder")}
                  />
                  <p className="text-xs text-gray-600">
                    {t("passengerFormSubPassengerWillBeAdded", {
                      count: passenger.sub_passenger_count || 0,
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

<div className="grid grid-cols-1 gap-1 xl:grid-cols-2">
          <section className="mono-panel p-1.5">
            <SectionHeader icon={UserRound} title={t("passengerFormIdentitySection")} />

            <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
              <div>
                <label className={labelClass}>{t("passengerFormSerialNo")}</label>
                <input
                  type="text"
                  value={passenger.serial_no || ""}
                  readOnly
                  className="mono-input bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className={labelClass}>
                  {t("passengerFormLastNameLabel")} *
                </label>
                <input
                  type="text"
                  value={passenger.last_name || ""}
                  onChange={(e) => debouncedUpdate("last_name", e.target.value)}
                  className={inputClass(Boolean(getError("last_name")))}
                  placeholder={t("passengerFormLastNamePlaceholder")}
                />
                {getError("last_name") && (
                  <p className={errorClass}>{getError("last_name").message}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>
                  {t("passengerFormFirstNameLabel")} *
                </label>
                <input
                  type="text"
                  value={passenger.first_name || ""}
                  autoFocus={
                    managerMode &&
                    (!passenger.first_name || passenger.first_name.trim() === "")
                  }
                  onChange={(e) => debouncedUpdate("first_name", e.target.value)}
                  className={inputClass(Boolean(getError("first_name")))}
                  placeholder={t("passengerFormFirstNamePlaceholder")}
                />
                {getError("first_name") && (
                  <p className={errorClass}>{getError("first_name").message}</p>
                )}
              </div>
            </div>

            <div className="mt-1 grid grid-cols-1 gap-1 md:grid-cols-3">
              <div>
                <label className={labelClass}>{t("passengerFormPaxType")} *</label>
                <select
                  value={passenger.pax_type || ""}
                  onChange={(e) => {
                    const newType = e.target.value as "Adult" | "Child" | "Infant";
                    immediateUpdate("pax_type", newType);
                  }}
                  className={selectClass(Boolean(getError("pax_type")))}
                >
                  <option value="" disabled>
                    {t("passengerFormSelectPaxType")} *
                  </option>
                  <option value="Adult">{t("passengerFormPaxTypeAdult")}</option>
                  <option value="Child">{t("passengerFormPaxTypeChild")}</option>
                  <option value="Infant">{t("passengerFormPaxTypeInfant")}</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>
                  {t("passengerFormItineraryStatus")} *
                </label>
                <select
                  value={passenger.itinerary_status ?? ""}
                  onChange={(e) => immediateUpdate("itinerary_status", e.target.value)}
                  className={selectClass(Boolean(getError("itinerary_status")))}
                >
                  <option value="" disabled>
                    {t("passengerFormSelectItineraryStatus")} *
                  </option>
                  <option value="With itinerary">{t("passengerFormItineraryWith")}</option>
                  <option value="No itinerary">{t("passengerFormItineraryNone")}</option>
                  <option value="Hotel + itinerary">
                    {t("passengerFormItineraryHotelWith")}
                  </option>
                  <option value="Hotel">{t("passengerFormItineraryHotelOnly")}</option>
                  <option value="Roundway ticket">
                    {t("passengerFormItineraryRoundway")}
                  </option>
                </select>

                <div className="mt-2">
                  <span
                    className={`mono-badge ${
                      passenger.itinerary_status &&
                      passenger.itinerary_status !== "No itinerary"
                        ? "mono-badge--success"
                        : ""
                    }`}
                  >
                    {passenger.itinerary_status || t("passengerFormItineraryNone")}
                  </span>
                </div>
              </div>

              <div className="mono-panel flex items-center px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={passenger.has_baby_bed || false}
                    onChange={(e) =>
                      immediateUpdate("has_baby_bed", e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>{t("passengerFormBabyBed")}</span>
                </label>
              </div>
            </div>
          </section>

<section className="mono-panel p-1.5">
            <SectionHeader icon={Contact} title={t("passengerFormContactSection")} />

            <div className="grid grid-cols-1 gap-1">
              <div>
                <label className={labelClass}>{t("email")} *</label>
                <input
                  type="email"
                  value={passenger.email || ""}
                  onChange={(e) => debouncedUpdate("email", e.target.value)}
                  className={inputClass(Boolean(getError("email")))}
                  placeholder={t("passengerFormEmailPlaceholder")}
                />
                {getError("email") && (
                  <p className={errorClass}>{getError("email").message}</p>
                )}
              </div>

<div className="grid grid-cols-1 gap-1 md:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("phone")} *</label>
                  <input
                    type="tel"
                    value={passenger.phone || ""}
                    onChange={(e) => debouncedUpdate("phone", e.target.value)}
                    className={inputClass(Boolean(getError("phone")))}
                    placeholder={t("passengerFormPhonePlaceholder")}
                  />
                  {getError("phone") && (
                    <p className={errorClass}>{getError("phone").message}</p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    {t("passengerFormEmergencyPhone")}
                  </label>
                  <input
                    type="tel"
                    value={passenger.emergency_phone || ""}
                    onChange={(e) =>
                      debouncedUpdate("emergency_phone", e.target.value)
                    }
                    className="mono-input"
                    placeholder={t("passengerFormEmergencyPhonePlaceholder")}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

<div className="grid grid-cols-1 gap-1.5 xl:grid-cols-2">
          <section className="mono-panel p-1.5">
            <SectionHeader icon={VenetianMask} title={t("passengerFormDemographicsSection")} />

            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t("dob")} *</label>
                <input
                  type="date"
                  value={formattedDob}
                  onChange={(e) => immediateUpdate("date_of_birth", e.target.value)}
                  className={inputClass(Boolean(getError("date_of_birth")))}
                />
              </div>

              <div>
                <label className={labelClass}>{t("passengerFormAge")}</label>
                <input
                  type="number"
                  value={age != null ? age.toString() : ""}
                  readOnly
                  className="mono-input bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className={labelClass}>{t("gender")} *</label>
                <select
                  value={passenger.gender || ""}
                  onChange={(e) => immediateUpdate("gender", e.target.value)}
                  className={selectClass(Boolean(getError("gender")))}
                >
                  <option value="">{t("passengerFormSelectGender")}</option>
                  <option value="Male">{t("passengerFormGenderMale")}</option>
                  <option value="Female">{t("passengerFormGenderFemale")}</option>
                  <option value="Other">{t("passengerFormGenderOther")}</option>
                </select>
                {getError("gender") && (
                  <p className={errorClass}>{getError("gender").message}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>{t("nationality")} *</label>
                <select
                  value={passenger.nationality || ""}
                  onChange={(e) => immediateUpdate("nationality", e.target.value)}
                  className={selectClass(Boolean(getError("nationality")))}
                >
                  {nationalities.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                {getError("nationality") && (
                  <p className={errorClass}>{getError("nationality").message}</p>
                )}
              </div>
            </div>
          </section>

<section className="mono-panel p-1.5">
            <SectionHeader icon={IdCard} title={t("passengerFormPassportSection")} />

            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              <div>
                <label className={labelClass}>{t("passportNumber")} *</label>
                <input
                  type="text"
                  value={passenger.passport_number || ""}
                  onChange={(e) =>
                    debouncedUpdate("passport_number", e.target.value)
                  }
                  className={inputClass(Boolean(getError("passport_number")))}
                  placeholder={t("passengerFormPassportNumberPlaceholder")}
                />
                {getError("passport_number") && (
                  <p className={errorClass}>{getError("passport_number").message}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>{t("passengerFormPassportExpiry")} *</label>
                <input
                  type="date"
                  value={formattedExpiry}
                  onChange={(e) =>
                    immediateUpdate("passport_expire", e.target.value)
                  }
                  className={`mono-input ${
                    getError("passport_expire")
                      ? "border-red-400"
                      : getPassportExpiryColor(passenger.passport_expire)
                  }`}
                />
                {getError("passport_expire") && (
                  <p className={errorClass}>{getError("passport_expire").message}</p>
                )}
              </div>
            </div>

<div className="mt-1 mono-panel p-1.5">
              <label className={labelClass}>{t("passengerFormPassportUpload")}</label>
              <div className="flex flex-wrap items-center gap-1">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handlePassportUpload}
                  className="text-[10px] text-gray-600 file:mr-1 file:rounded-sm file:border file:border-gray-300 file:bg-white file:px-2 file:py-1 file:text-[10px] file:font-medium file:text-gray-700 hover:file:bg-gray-50"
                />
                {(fieldLoading[`${passenger.id}-passport_upload`] || uploadLoading) && (
                  <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-gray-700" />
                )}
                <span
                  className={`mono-badge ${
                    passenger.passport_upload ? "mono-badge--success" : ""
                  }`}
                >
                  {passenger.passport_upload
                    ? t("passengerFormUploaded")
                    : t("passengerFormNotUploaded")}
                </span>
              </div>
            </div>
          </section>
        </div>

<section className="mono-panel p-1.5">
          <SectionHeader icon={BedDouble} title={t("passengerFormStaySection")} />

          <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
            <div>
              <label className={labelClass}>{t("roomType")} *</label>
              <select
                value={localRoomType}
                onChange={(e) => handleRoomTypeChange(e.target.value)}
                className={`${selectClass(Boolean(getError("roomType")))} ${
                  passenger.main_passenger_id ? "opacity-80" : ""
                }`}
                disabled={!!passenger.main_passenger_id}
              >
                <option value="">{t("passengerFormSelectRoomType")}</option>
                {roomTypes.map((rt) => (
                  <option key={rt} value={rt}>
                    {rt}
                  </option>
                ))}
              </select>
              {getError("roomType") && (
                <p className={errorClass}>{getError("roomType").message}</p>
              )}
            </div>

<div>
              <label className={labelClass}>{t("roomAllocation")}</label>
              <div className="mono-panel flex min-h-[32px] items-center px-1.5">
                <span className="mono-badge text-[10px]">
                  {passenger.room_allocation || t("notSet")}
                </span>
              </div>
            </div>

            <div>
              <label className={labelClass}>{t("hotel")} *</label>
              <select
                value={passenger.hotel || ""}
                onChange={(e) => immediateUpdate("hotel", e.target.value)}
                className={selectClass(Boolean(getError("hotel")))}
              >
                <option value="">{t("passengerFormSelectHotel")}</option>
                {hotels.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              {getError("hotel") && (
                <p className={errorClass}>{getError("hotel").message}</p>
              )}
            </div>
          </div>
        </section>

<section className="mono-panel p-1.5">
          <SectionHeader
            icon={Sparkles}
            title={t("passengerFormExtrasSection")}
            hint={managerMode ? t("managerOptionalDetails") : undefined}
          />

          <div className="grid grid-cols-1 gap-1 lg:grid-cols-2">
            <div>
              <label className={labelClass}>{t("passengerFormAdditionalServices")}</label>
              {selectedTourData?.services && selectedTourData.services.length > 0 ? (
                <div className="mono-panel max-h-20 space-y-0.5 overflow-y-auto p-1.5">
                  {selectedTourData.services.map((s) => (
                    <label key={s.name} className="flex items-center gap-1 text-[10px] text-gray-700">
                      <input
                        type="checkbox"
                        checked={(passenger.additional_services || []).includes(
                          s.name,
                        )}
                        onChange={(e) =>
                          handleServiceChange(s.name, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span>
                        {s.name} (${s.price})
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {t("passengerFormServicesUnavailable")}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>{t("passengerFormAllergies")}</label>
              <input
                type="text"
                value={passenger.allergy || ""}
                onChange={(e) => debouncedUpdate("allergy", e.target.value)}
                className="mono-input"
                placeholder={t("passengerFormAllergiesPlaceholder")}
              />
            </div>
          </div>

<div className="mt-1">
            <SectionHeader icon={FileText} title={t("notes")} />
            <textarea
              value={passenger.notes || ""}
              onChange={(e) => debouncedUpdate("notes", e.target.value)}
              className="mono-input min-h-[40px] text-[10px]"
              placeholder={t("passengerFormNotesPlaceholder")}
              rows={1}
            />
          </div>
        </section>
      </div>
    );
  },
  (prev, next) => {
    // Only re-render if something actually relevant changed
    return (
      prev.passenger === next.passenger &&
      prev.index === next.index &&
      prev.expanded === next.expanded &&
      prev.errors === next.errors &&
      prev.fieldLoading === next.fieldLoading &&
      prev.selectedTourData?.services === next.selectedTourData?.services &&
      prev.nationalities === next.nationalities &&
      prev.roomTypes === next.roomTypes &&
      prev.hotels === next.hotels &&
      prev.managerMode === next.managerMode
    );
  },
);

PassengerFormFields.displayName = "PassengerFormFields";
