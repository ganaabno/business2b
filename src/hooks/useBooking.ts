import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import type {
  Tour,
  Passenger,
  User as UserType,
  ValidationError,
  Order,
  Notification as NotificationType,
  LeadPassenger,
  PassengerFormData,
} from "../types/type";
import { checkSeatLimit } from "../utils/seatLimitChecks";
import { assignRoomAllocation } from "../addPassengerComponents/roomAllocationLogic";
import {
  cleanValueForDB,
  createNewPassenger,
  createNewPassengerLocal,
} from "../utils/bookingUtils";
import {
  ensureGlobalTourBookable,
  syncGlobalPriceRowCanonical,
} from "../api/b2b";
import { createSharedBooking, getDepartureSeatStats } from "../api/sharedBookings";
import { isTourBookableInB2B } from "../utils/tourSource";

const CSV_FIELD_ALIASES = {
  serial_no: ["serial no", "serial number", "serial", "serial_no"],
  first_name: ["first name", "given name", "firstname"],
  last_name: ["last name", "surname", "lastname"],
  email: ["email", "email address"],
  phone: ["phone", "phone number", "mobile"],
  emergency_phone: ["emergency phone", "emergency", "emergency contact"],
  date_of_birth: ["date of birth", "dob", "birth date"],
  age: ["age"],
  gender: ["gender", "sex"],
  nationality: ["nationality", "citizenship"],
  passport_number: ["passport number", "passport no", "passport"],
  passport_expire: ["passport expiry", "passport expire", "passport expiration"],
  room_type: ["room type", "room"],
  room_allocation: ["room allocation", "room no", "room number"],
  hotel: ["hotel"],
  additional_services: ["additional services", "services", "service"],
  allergy: ["allergy", "allergies"],
  price: ["price", "total price", "amount"],
  itinerary_status: ["flight & hotel status", "flight hotel status", "itinerary status"],
  baby_bed: ["baby bed", "has baby bed", "baby cot"],
} as const;

type CsvFieldKey = keyof typeof CSV_FIELD_ALIASES;
type CsvImportMode = "immediate" | "preview";

type CsvDuplicateField = "passport_number" | "email" | "phone";
type CsvDuplicateScope = "csv" | "booking" | "existing";

type CsvDuplicateHit = {
  field: CsvDuplicateField;
  scope: CsvDuplicateScope;
  normalizedValue: string;
  matchedLabel?: string;
};

type CsvRowStatus = "ready" | "warning" | "blocked";

type CsvParsedRow = {
  rowNumber: number;
  serialNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyPhone: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  nationality: string;
  passportNumber: string;
  passportExpire: string | null;
  roomType: string;
  roomAllocation: string;
  hotel: string;
  additionalServices: string[];
  allergy: string;
  price: number;
  itineraryStatus: Passenger["itinerary_status"];
  hasBabyBed: boolean;
};

type CsvPreviewRow = {
  rowNumber: number;
  data: CsvParsedRow;
  blockers: string[];
  warnings: string[];
  duplicateHits: CsvDuplicateHit[];
  status: CsvRowStatus;
};

type CsvImportPreview = {
  open: boolean;
  fileName: string;
  rows: CsvPreviewRow[];
  summary: {
    total: number;
    ready: number;
    warning: number;
    blocked: number;
  };
  ignoredServicesCount: number;
};

const CSV_IMPORT_REQUIRED_FIELDS: Array<{ fieldKey: CsvFieldKey; label: string }> = [
  { fieldKey: "first_name", label: "First Name" },
  { fieldKey: "last_name", label: "Last Name" },
  { fieldKey: "email", label: "Email" },
  { fieldKey: "phone", label: "Phone" },
  { fieldKey: "date_of_birth", label: "Date of Birth" },
  { fieldKey: "nationality", label: "Nationality" },
  { fieldKey: "passport_number", label: "Passport Number" },
  { fieldKey: "room_type", label: "Room Type" },
  { fieldKey: "hotel", label: "Hotel" },
];

const CSV_EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const normalizeCsvHeader = (value: string): string =>
  String(value || "")
    .replace(/\uFEFF/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ");

const splitCsvList = (value: string): string[] => {
  const source = String(value || "").trim();
  if (!source) return [];
  const separator = source.includes("|")
    ? "|"
    : source.includes(";")
      ? ";"
      : ",";
  return source
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBooleanLike = (value: string): boolean => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "yes", "y", "1", "checked"].includes(normalized);
};

const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const getCsvValue = (
  normalizedRow: Record<string, string>,
  fieldKey: CsvFieldKey,
): string => {
  for (const alias of CSV_FIELD_ALIASES[fieldKey]) {
    const value = normalizedRow[normalizeCsvHeader(alias)];
    if (value !== undefined) {
      return String(value).trim();
    }
  }
  return "";
};

const normalizeDuplicateValue = (
  field: CsvDuplicateField,
  value: string | null | undefined,
): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (field === "email") {
    return raw.toLowerCase();
  }

  if (field === "phone") {
    return raw.replace(/[^0-9+]/g, "");
  }

  return raw.replace(/[\s-]+/g, "").toUpperCase();
};

interface UseBookingProps {
  tours: Tour[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  selectedTour: string;
  setSelectedTour: React.Dispatch<React.SetStateAction<string>>;
  departureDate: string;
  setDepartureDate: React.Dispatch<React.SetStateAction<string>>;
  errors: ValidationError[];
  setErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
  currentUser: UserType;
  strictSeatAccessGateEnabled?: boolean;
  strictSeatRequestId?: string | null;
  strictSeatRequestCanBook?: boolean;
  strictSeatRequestTourId?: string | null;
  strictSeatRequestTravelDate?: string | null;
  strictSeatRequestSeats?: number;
  csvImportMode?: CsvImportMode;
}

declare global {
  var __bookingPassengers: Passenger[];
}

export const useBooking = ({
  tours,
  setOrders,
  selectedTour,
  setSelectedTour,
  departureDate,
  setDepartureDate,
  errors,
  setErrors,
  currentUser,
  strictSeatAccessGateEnabled = false,
  strictSeatRequestId = null,
  strictSeatRequestCanBook = true,
  strictSeatRequestTourId = null,
  strictSeatRequestTravelDate = null,
  strictSeatRequestSeats = 0,
  csvImportMode = "immediate",
}: UseBookingProps) => {
  const { t } = useTranslation();
  const [bookingPassengers, setBookingPassengers] = useState<Passenger[]>([]);
  const [existingPassengers, setExistingPassengers] = useState<Passenger[]>([]);
  const [activeStep, setActiveStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInProvider, setShowInProvider] = useState(false);
  const [expandedPassengerId, setExpandedPassengerId] = useState<string | null>(
    null,
  );
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({});
  const [canAdd, setCanAdd] = useState(true);
  const [availableHotels, setAvailableHotels] = useState<string[]>([]);
  const [notification, setNotification] = useState<NotificationType | null>(
    null,
  );
  const [leadPassengerData, setLeadPassengerData] =
    useState<LeadPassenger | null>(null);
  const [showPassengerPrompt, setShowPassengerPrompt] = useState(false);
  const [passengerCountInput, setPassengerCountInput] = useState("");
  const [passengerFormData, setPassengerFormData] =
    useState<PassengerFormData | null>(null);
  const [csvImportPreview, setCsvImportPreview] = useState<CsvImportPreview>({
    open: false,
    fileName: "",
    rows: [],
    summary: { total: 0, ready: 0, warning: 0, blocked: 0 },
    ignoredServicesCount: 0,
  });
  const newPassengerRef = useRef<HTMLDivElement | null>(null);

  const bookingPassengersRef = useRef<Passenger[]>([]);
  useEffect(() => {
    bookingPassengersRef.current = bookingPassengers;
  }, [bookingPassengers]);

  // CHANGE 1: Allow user to add, but only admin/manager save to passengers
  const canAddPassengers = ["admin", "manager", "superadmin", "user"].includes(
    currentUser.role || "user",
  );
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || "user",
  );

  const normalizeDateOnly = (value: string | null | undefined) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    return trimmed.split("T")[0] || trimmed;
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === "object") {
      const source = error as { message?: unknown };
      if (typeof source.message === "string" && source.message.trim()) {
        return source.message.trim();
      }
    }

    return fallback;
  };

  const strictGateRequired = strictSeatAccessGateEnabled && !isPowerUser;
  const strictGateSatisfied =
    !strictGateRequired ||
    (Boolean(strictSeatRequestId) && Boolean(strictSeatRequestCanBook));

  const selectedTourData = useMemo(() => {
    const normalized = selectedTour.trim().toLowerCase();
    if (!normalized) return undefined;

    const matchedTours = tours.filter(
      (tour) => tour.title.trim().toLowerCase() === normalized,
    );

    return (
      matchedTours.find((tour) => isTourBookableInB2B(tour)) ?? matchedTours[0]
    );
  }, [tours, selectedTour]);
  const effectiveDepartureDate = departureDate;

  // === FETCH EXISTING PASSENGERS ===
  useEffect(() => {
    if (!selectedTourData || !effectiveDepartureDate) {
      setExistingPassengers([]);
      return;
    }

    const fetchExisting = async () => {
      const target = isPowerUser ? "passengers" : "passenger_requests";
      const { data, error } = await supabase
        .from(target)
        .select("*")
        .eq("tour_id", selectedTourData.id)
        .eq("departure_date", effectiveDepartureDate);

      if (error) {
        return;
      }

      setExistingPassengers(data || []);
    };

    fetchExisting();
  }, [selectedTourData, effectiveDepartureDate, isPowerUser]);

  // === REASSIGN ROOMS ===
  const reassignAllRooms = useCallback(async () => {
    const allPassengers = [
      ...existingPassengers,
      ...bookingPassengersRef.current,
    ];
    const updated = await Promise.all(
      bookingPassengersRef.current.map(async (p) => ({
        ...p,
        room_allocation: await assignRoomAllocation(
          allPassengers,
          p,
          effectiveDepartureDate,
        ).catch(() => "M1"),
      })),
    );

    const oldRooms = bookingPassengersRef.current.map((p) => p.room_allocation);
    const newRooms = updated.map((p) => p.room_allocation);

    if (JSON.stringify(oldRooms) !== JSON.stringify(newRooms)) {
      setBookingPassengers(updated);
    }
  }, [existingPassengers, effectiveDepartureDate]);

  useEffect(() => {
    reassignAllRooms();
  }, [existingPassengers, reassignAllRooms]);

  // Clear payment error
  useEffect(() => {
    if (paymentMethod.length > 0) {
      setErrors((prev) => prev.filter((e) => e.field !== "payment"));
    }
  }, [paymentMethod, setErrors]);

  // In useBooking.ts — KEEP IT, but make it safe
  const confirmLeadPassenger = useCallback(() => {
    if (!leadPassengerData) {
      setNotification({ type: "error", message: t("bookingNoLeadData") });
      return;
    }

    // ONLY run if we have leadPassengerData AND no passengers yet
    if (bookingPassengers.length === 0) {
      addMultiplePassengers(1);
    }
  }, [leadPassengerData, bookingPassengers.length, t]);

  // === UPDATE PASSENGER ===
  const updatePassenger = useCallback(
    async (
      index: number,
      field: keyof Passenger | "subPassengerCount" | "hasSubPassengers",
      value: any,
    ) => {
      if (index < 0 || index >= bookingPassengers.length) return;

      let updatedPassengers = [...bookingPassengers];
      const passenger = updatedPassengers[index];
      let shouldReassign = false;

      if (field === "hasSubPassengers") {
        // Only when checkbox is clicked → create/remove subs
        updatedPassengers[index] = { ...passenger, has_sub_passengers: value };
        if (!value) {
          updatedPassengers[index].sub_passenger_count = 0;
          updatedPassengers = updatedPassengers.filter(
            (p) => p.main_passenger_id !== passenger.id,
          );
        }
        shouldReassign = true;
      } else if (
        field === "subPassengerCount" &&
        passenger.has_sub_passengers
      ) {
        // ONLY create subs when checkbox is ON
        const count = Math.max(0, parseInt(value, 10) || 0);
        updatedPassengers = updatedPassengers.filter(
          (p) => p.main_passenger_id !== passenger.id,
        );
        updatedPassengers[index].sub_passenger_count = count;

        if (count > 0) {
          const newSubs = await Promise.all(
            Array.from({ length: count }, async () => {
              const sub = createNewPassengerLocal(
                currentUser,
                updatedPassengers,
                selectedTourData,
                availableHotels,
                {
                  main_passenger_id: passenger.id,
                  roomType: passenger.roomType || "Single",
                  serial_no: passenger.serial_no,
                  departureDate: effectiveDepartureDate,
                },
              );
              sub.room_allocation = await assignRoomAllocation(
                [...existingPassengers, ...updatedPassengers, sub],
                sub,
                effectiveDepartureDate,
              ).catch(() => "M1");
              return sub;
            }),
          );
          updatedPassengers.splice(index + 1, 0, ...newSubs);
        }
        shouldReassign = true;
      } else {
        // Normal field update
        const updated = {
          ...passenger,
          [field]: cleanValueForDB(field, value),
          updated_at: new Date().toISOString(),
        };
        if (field === "roomType") {
          shouldReassign = true;
          updatedPassengers.forEach((p, i) => {
            if (p.main_passenger_id === passenger.id) {
              updatedPassengers[i].roomType = value;
            }
          });
        }
        updatedPassengers[index] = updated;
      }

      if (shouldReassign) {
        const all = [...existingPassengers, ...updatedPassengers];
        const rooms = await Promise.all(
          updatedPassengers.map((p) =>
            assignRoomAllocation(all, p, effectiveDepartureDate).catch(
              () => "M1",
            ),
          ),
        );
        updatedPassengers = updatedPassengers.map((p, i) => ({
          ...p,
          room_allocation: rooms[i],
        }));
      }

      setBookingPassengers(updatedPassengers);
    },
    [
      bookingPassengers,
      currentUser,
      selectedTourData,
      availableHotels,
      effectiveDepartureDate,
      existingPassengers,
    ],
  );

  // === ADD MULTIPLE PASSENGERS ===
  const addMultiplePassengers = useCallback(
    async (count: number): Promise<number> => {
      const startIndex = bookingPassengers.length;
      if (count <= 0) return -1;

      const newPassengers: Passenger[] = [];
      for (let i = 0; i < count; i++) {
        const passenger = createNewPassenger(
          currentUser,
          [...bookingPassengers, ...newPassengers],
          selectedTourData,
          availableHotels,
          {},
          effectiveDepartureDate,
        );
        passenger.room_allocation = await assignRoomAllocation(
          [...existingPassengers, ...bookingPassengers, ...newPassengers],
          passenger,
          effectiveDepartureDate,
        ).catch(() => "M1");
        newPassengers.push(passenger);
      }

      setBookingPassengers((prev) => [...prev, ...newPassengers]);
      setExpandedPassengerId(newPassengers[0]?.id || null);
      return startIndex;
    },
    [
      bookingPassengers.length,
      currentUser,
      selectedTourData,
      availableHotels,
      effectiveDepartureDate,
      existingPassengers,
    ],
  );

  const remainingSeats = useMemo(() => {
    if (isPowerUser || !selectedTourData?.available_seats) return undefined;
    return Math.max(
      0,
      selectedTourData.available_seats -
        (bookingPassengers.length + (leadPassengerData?.seat_count || 0)),
    );
  }, [
    isPowerUser,
    selectedTourData,
    bookingPassengers.length,
    leadPassengerData,
  ]);

  useEffect(() => {
    const canAddValue =
      !!selectedTour &&
      !!departureDate &&
      !!selectedTourData &&
      strictGateSatisfied &&
      (isPowerUser || (remainingSeats !== undefined && remainingSeats > 0));
    setCanAdd(canAddValue);
  }, [
    selectedTour,
    departureDate,
    selectedTourData,
    isPowerUser,
    strictGateSatisfied,
    remainingSeats,
  ]);

  // HOTELS
  useEffect(() => {
    if (!selectedTourData?.hotels) {
      setAvailableHotels([]);
      return;
    }

    const rawHotels = selectedTourData.hotels;
    const hotels: string[] = [];

    if (Array.isArray(rawHotels)) {
      hotels.push(
        ...rawHotels
          .filter((h): h is string => typeof h === "string")
          .map((h) => h.trim())
          .filter((h) => h.length > 0),
      );
    } else if (typeof rawHotels === "string") {
      hotels.push(
        ...rawHotels
          .split(",")
          .map((h) => h.trim())
          .filter((h) => h.length > 0),
      );
    }

    setAvailableHotels(hotels);
  }, [selectedTourData]);

  const showNotification = useCallback(
    (type: "success" | "error", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
    },
    [],
  );

  const calculateAge = useCallback(
    (dateOfBirth: string | undefined | null): number => {
      const dob = new Date(cleanValueForDB("date_of_birth", dateOfBirth) || "");
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      return Math.max(0, age);
    },
    [],
  );

  const calculateServicePrice = useCallback(
    (services: string[], tourData: Tour): number => {
      return services.reduce((sum, name) => {
        const s = tourData.services.find((x) => x.name === name);
        return sum + (s?.price || 0);
      }, 0);
    },
    [],
  );

  const canAddPassenger = useCallback(async () => {
    if (!selectedTour || !departureDate || !selectedTourData) return false;
    if (!strictGateSatisfied) return false;
    if (!isPowerUser && remainingSeats !== undefined && remainingSeats <= 0)
      return false;
    const { isValid } = await checkSeatLimit(
      selectedTourData.id,
      departureDate,
      currentUser.role,
    );
    return isValid;
  }, [
    selectedTour,
    departureDate,
    selectedTourData,
    strictGateSatisfied,
    isPowerUser,
    remainingSeats,
    currentUser.role,
  ]);

  // === REMOVE PASSENGER ===
  const removePassenger = useCallback(
    async (index: number) => {
      if (bookingPassengers.length === 1) {
        showNotification("error", t("bookingAtLeastOnePassenger"));
        return;
      }
      const passengerToRemove = bookingPassengers[index];
      let updatedPassengers = [...bookingPassengers];
      const filteredLocal = updatedPassengers
        .filter((_, i) => i !== index)
        .filter((p) => p.main_passenger_id !== passengerToRemove.id);
      const allPassengers = [...existingPassengers, ...filteredLocal];
      const updated = await Promise.all(
        filteredLocal.map(async (p) => ({
          ...p,
          room_allocation: await assignRoomAllocation(
            allPassengers,
            p,
            effectiveDepartureDate,
          ).catch(() => "M1"),
        })),
      );

      setBookingPassengers(updated);
      if (expandedPassengerId === bookingPassengers[index].id)
        setExpandedPassengerId(null);
      showNotification("success", t("bookingRemovedPassenger", { index: index + 1 }));
    },
    [
      bookingPassengers,
      expandedPassengerId,
      showNotification,
      effectiveDepartureDate,
      existingPassengers,
      t,
    ],
  );

  const clearAllPassengers = useCallback(() => {
    if (bookingPassengers.length === 0) return;
    if (
      window.confirm(
        t("bookingRemoveAllPassengersConfirm", {
          count: bookingPassengers.length,
        }),
      )
    ) {
      setBookingPassengers([]);
      setExpandedPassengerId(null);
      showNotification("success", t("bookingAllPassengersCleared"));
    }
  }, [bookingPassengers.length, showNotification, t]);

  const resetCsvImportPreview = useCallback(() => {
    setCsvImportPreview({
      open: false,
      fileName: "",
      rows: [],
      summary: { total: 0, ready: 0, warning: 0, blocked: 0 },
      ignoredServicesCount: 0,
    });
  }, []);

  const resetBookingForm = useCallback(() => {
    setBookingPassengers([]);
    setSelectedTour("");
    setDepartureDate("");
    setPaymentMethod([]);
    setActiveStep(1);
    setShowInProvider(false);
    setExpandedPassengerId(null);
    setErrors([]);
    setLeadPassengerData(null);
    setPassengerFormData(null);
    setShowPassengerPrompt(false);
    setPassengerCountInput("");
    resetCsvImportPreview();
    showNotification("success", t("bookingFormReset"));
  }, [
    setSelectedTour,
    setDepartureDate,
    setErrors,
    showNotification,
    resetCsvImportPreview,
    t,
  ]);

  const clearCsvErrors = useCallback(() => {
    setErrors((prev) =>
      prev.filter((error) => !String(error.field || "").startsWith("csv_row_")),
    );
  }, [setErrors]);

  const handleDownloadCSV = useCallback(() => {
    if (bookingPassengers.length === 0) {
      showNotification("error", t("bookingNoPassengersToExport"));
      return;
    }

    const headers = [
      "Serial No",
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Emergency Phone",
      "Date of Birth",
      "Age",
      "Gender",
      "Nationality",
      "Passport Number",
      "Passport Expiry",
      "Room Type",
      "Room Allocation",
      "Hotel",
      "Additional Services",
      "Allergies",
      "Price",
      "Flight & Hotel Status",
      "Baby Bed",
    ];

    const rows = bookingPassengers.map((passenger) =>
      [
        passenger.serial_no || "",
        passenger.first_name || "",
        passenger.last_name || "",
        passenger.email || "",
        passenger.phone || "",
        passenger.emergency_phone || "",
        passenger.date_of_birth || "",
        passenger.age ?? "",
        passenger.gender || "",
        passenger.nationality || "",
        passenger.passport_number || "",
        passenger.passport_expire || "",
        passenger.roomType || "",
        passenger.room_allocation || "",
        passenger.hotel || "",
        (passenger.additional_services || []).join(" | "),
        passenger.allergy || "",
        passenger.price ?? "",
        passenger.itinerary_status || "No itinerary",
        passenger.has_baby_bed ? "Yes" : "No",
      ]
        .map((value) => escapeCsvCell(value))
        .join(","),
    );

    const csvData = `\uFEFF${[headers.join(","), ...rows].join("\n")}`;
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const normalizedTour = String(
      selectedTourData?.title || selectedTour || "tour",
    )
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    link.href = url;
    link.download = `passengers_${normalizedTour || "tour"}_${
      effectiveDepartureDate || new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    showNotification("success", t("bookingPassengerCsvExported"));
  }, [
    bookingPassengers,
    selectedTourData,
    selectedTour,
    effectiveDepartureDate,
    showNotification,
    t,
  ]);

  const parseCsvRows = useCallback(
    async (file: File) => {
      if (!selectedTourData || !effectiveDepartureDate) {
        throw new Error(t("csvSelectTourDateFirst"));
      }

      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error(t("csvUploadOnlyCsv"));
      }

      const csvText = await file.text();
      const parsed = Papa.parse<Record<string, string | undefined>>(csvText, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.replace(/\uFEFF/g, "").trim(),
      });

      const parseErrors = (parsed.errors || []).filter(
        (error) => error.code !== "TooFewFields",
      );
      if (parseErrors.length > 0) {
        throw new Error(
          t("csvParseFailedNearRow", { row: parseErrors[0]?.row ?? "?" }),
        );
      }

      if (!parsed.data || parsed.data.length === 0) {
        throw new Error(t("csvNoPassengerRows"));
      }

      const normalizedHeaderSet = new Set(
        (parsed.meta.fields || []).map((header) => normalizeCsvHeader(header)),
      );

      const missingHeaders = CSV_IMPORT_REQUIRED_FIELDS.filter(({ fieldKey }) =>
        CSV_FIELD_ALIASES[fieldKey].every(
          (alias) => !normalizedHeaderSet.has(normalizeCsvHeader(alias)),
        ),
      ).map(({ label }) => label);

      if (missingHeaders.length > 0) {
        throw new Error(
          t("csvMissingRequiredColumns", {
            columns: missingHeaders.join(", "),
          }),
        );
      }

      const serviceMap = new Map(
        (selectedTourData.services || []).map((service) => [
          String(service.name || "").trim().toLowerCase(),
          String(service.name || "").trim(),
        ]),
      );

      const rowErrors: string[] = [];
      let ignoredServicesCount = 0;
      const parsedRows: CsvParsedRow[] = [];

      parsed.data.forEach((row, index) => {
        const rowNumber = index + 2;
        const normalizedRow: Record<string, string> = {};

        Object.entries(row || {}).forEach(([key, value]) => {
          if (key !== "__parsed_extra") {
            normalizedRow[normalizeCsvHeader(key)] = String(value || "").trim();
          }
        });

        const extraColumns = Array.isArray((row as any).__parsed_extra)
          ? ((row as any).__parsed_extra as string[]).filter(Boolean)
          : [];

        if (extraColumns.length > 0) {
          rowErrors.push(
            t("csvRowHasExtraValues", {
              row: rowNumber,
            }),
          );
          return;
        }

        const serialNo = getCsvValue(normalizedRow, "serial_no");
        const firstName = getCsvValue(normalizedRow, "first_name");
        const lastName = getCsvValue(normalizedRow, "last_name");
        const email = getCsvValue(normalizedRow, "email");
        const phone = getCsvValue(normalizedRow, "phone");
        const emergencyPhone = getCsvValue(normalizedRow, "emergency_phone");
        const dateOfBirthRaw = getCsvValue(normalizedRow, "date_of_birth");
        const ageRaw = getCsvValue(normalizedRow, "age");
        const gender = getCsvValue(normalizedRow, "gender");
        const nationality = getCsvValue(normalizedRow, "nationality") || "Mongolia";
        const passportNumber = getCsvValue(normalizedRow, "passport_number");
        const passportExpireRaw = getCsvValue(normalizedRow, "passport_expire");
        const roomType = getCsvValue(normalizedRow, "room_type");
        const roomAllocation = getCsvValue(normalizedRow, "room_allocation");
        const hotel = getCsvValue(normalizedRow, "hotel") || availableHotels[0] || "";
        const additionalServicesRaw = getCsvValue(normalizedRow, "additional_services");
        const allergy = getCsvValue(normalizedRow, "allergy");
        const priceRaw = getCsvValue(normalizedRow, "price");
        const itineraryStatusRaw = getCsvValue(normalizedRow, "itinerary_status");
        const babyBedRaw = getCsvValue(normalizedRow, "baby_bed");

        const missingRequired = CSV_IMPORT_REQUIRED_FIELDS.filter(
          ({ fieldKey }) => !getCsvValue(normalizedRow, fieldKey),
        ).map(({ label }) => label);

        const currentRowErrors: string[] = [];
        if (missingRequired.length > 0) {
          currentRowErrors.push(
            t("csvRowMissingRequired", {
              fields: missingRequired.join(", "),
            }),
          );
        }

        if (email && !CSV_EMAIL_REGEX.test(email)) {
          currentRowErrors.push(t("csvRowInvalidEmail"));
        }

        const dateOfBirth = cleanValueForDB("date_of_birth", dateOfBirthRaw);
        if (dateOfBirthRaw && !dateOfBirth) {
          currentRowErrors.push(t("csvRowInvalidDob"));
        }

        const passportExpire = cleanValueForDB("passport_expire", passportExpireRaw);
        if (passportExpireRaw && !passportExpire) {
          currentRowErrors.push(t("csvRowInvalidPassportExpiry"));
        }

        if (currentRowErrors.length > 0) {
          rowErrors.push(
            t("csvRowErrorLine", {
              row: rowNumber,
              message: currentRowErrors.join("; "),
            }),
          );
          return;
        }

        const requestedServices = splitCsvList(additionalServicesRaw);
        const resolvedServices = requestedServices
          .map((serviceName) => serviceMap.get(serviceName.toLowerCase()) || "")
          .filter(Boolean);
        ignoredServicesCount += requestedServices.length - resolvedServices.length;

        const parsedPrice = Number.parseFloat(
          String(priceRaw || "").replace(/[^0-9.-]/g, ""),
        );
        const hasPrice = Number.isFinite(parsedPrice);
        const computedPrice =
          (selectedTourData.base_price || 0) +
          calculateServicePrice(resolvedServices, selectedTourData);
        const ageFromCsv = Number.parseInt(ageRaw, 10);

        const itineraryStatus =
          itineraryStatusRaw === "With itinerary" ||
          itineraryStatusRaw === "No itinerary" ||
          itineraryStatusRaw === "Hotel + itinerary" ||
          itineraryStatusRaw === "Hotel" ||
          itineraryStatusRaw === "Roundway ticket"
            ? itineraryStatusRaw
            : "No itinerary";

        parsedRows.push({
          rowNumber,
          serialNo,
          firstName,
          lastName,
          email,
          phone,
          emergencyPhone,
          dateOfBirth: String(dateOfBirth || ""),
          age:
            Number.isFinite(ageFromCsv) && ageFromCsv >= 0
              ? ageFromCsv
              : calculateAge(String(dateOfBirth || "")),
          gender,
          nationality,
          passportNumber,
          passportExpire: passportExpire || null,
          roomType,
          roomAllocation,
          hotel,
          additionalServices: resolvedServices,
          allergy,
          price: hasPrice ? parsedPrice : computedPrice,
          itineraryStatus,
          hasBabyBed: parseBooleanLike(babyBedRaw),
        });
      });

      return { parsedRows, rowErrors, ignoredServicesCount };
    },
    [
      selectedTourData,
      effectiveDepartureDate,
      t,
      availableHotels,
      calculateServicePrice,
      calculateAge,
    ],
  );

  const createImportPreviewRows = useCallback(
    (rows: CsvParsedRow[]): CsvPreviewRow[] => {
      const csvValueCounts: Record<CsvDuplicateField, Map<string, number>> = {
        passport_number: new Map(),
        email: new Map(),
        phone: new Map(),
      };

      const bump = (field: CsvDuplicateField, value: string) => {
        if (!value) return;
        const map = csvValueCounts[field];
        map.set(value, (map.get(value) || 0) + 1);
      };

      rows.forEach((row) => {
        bump("passport_number", normalizeDuplicateValue("passport_number", row.passportNumber));
        bump("email", normalizeDuplicateValue("email", row.email));
        bump("phone", normalizeDuplicateValue("phone", row.phone));
      });

      const bookingSets: Record<CsvDuplicateField, Set<string>> = {
        passport_number: new Set(),
        email: new Set(),
        phone: new Set(),
      };
      const existingSets: Record<CsvDuplicateField, Set<string>> = {
        passport_number: new Set(),
        email: new Set(),
        phone: new Set(),
      };

      bookingPassengersRef.current.forEach((passenger) => {
        bookingSets.passport_number.add(
          normalizeDuplicateValue("passport_number", passenger.passport_number),
        );
        bookingSets.email.add(normalizeDuplicateValue("email", passenger.email));
        bookingSets.phone.add(normalizeDuplicateValue("phone", passenger.phone));
      });

      existingPassengers.forEach((passenger) => {
        existingSets.passport_number.add(
          normalizeDuplicateValue("passport_number", passenger.passport_number),
        );
        existingSets.email.add(normalizeDuplicateValue("email", passenger.email));
        existingSets.phone.add(normalizeDuplicateValue("phone", passenger.phone));
      });

      const duplicateLabel = (field: CsvDuplicateField) => {
        if (field === "passport_number") return t("csvDuplicateFieldPassport");
        if (field === "email") return t("csvDuplicateFieldEmail");
        return t("csvDuplicateFieldPhone");
      };

      const scopeLabel = (scope: CsvDuplicateScope) => {
        if (scope === "csv") return t("csvDuplicateScopeCsv");
        if (scope === "booking") return t("csvDuplicateScopeBooking");
        return t("csvDuplicateScopeExisting");
      };

      return rows.map((row) => {
        const duplicateHits: CsvDuplicateHit[] = [];
        const values: Record<CsvDuplicateField, string> = {
          passport_number: normalizeDuplicateValue("passport_number", row.passportNumber),
          email: normalizeDuplicateValue("email", row.email),
          phone: normalizeDuplicateValue("phone", row.phone),
        };

        (Object.keys(values) as CsvDuplicateField[]).forEach((field) => {
          const value = values[field];
          if (!value) return;

          if ((csvValueCounts[field].get(value) || 0) > 1) {
            duplicateHits.push({
              field,
              scope: "csv",
              normalizedValue: value,
            });
          }
          if (bookingSets[field].has(value)) {
            duplicateHits.push({
              field,
              scope: "booking",
              normalizedValue: value,
            });
          }
          if (existingSets[field].has(value)) {
            duplicateHits.push({
              field,
              scope: "existing",
              normalizedValue: value,
            });
          }
        });

        const blockers = duplicateHits
          .filter((hit) => hit.field === "passport_number")
          .map((hit) =>
            t("csvDuplicateMessage", {
              field: duplicateLabel(hit.field),
              scope: scopeLabel(hit.scope),
            }),
          );

        const warnings = duplicateHits
          .filter((hit) => hit.field !== "passport_number")
          .map((hit) =>
            t("csvDuplicateMessage", {
              field: duplicateLabel(hit.field),
              scope: scopeLabel(hit.scope),
            }),
          );

        const status: CsvRowStatus =
          blockers.length > 0
            ? "blocked"
            : warnings.length > 0
              ? "warning"
              : "ready";

        return {
          rowNumber: row.rowNumber,
          data: row,
          blockers,
          warnings,
          duplicateHits,
          status,
        };
      });
    },
    [existingPassengers, t],
  );

  const importCsvRows = useCallback(
    async (rows: CsvParsedRow[]): Promise<Passenger[]> => {
      if (!selectedTourData || !effectiveDepartureDate) return [];

      const currentBookingPassengers = bookingPassengersRef.current;
      const currentMainCount = currentBookingPassengers.filter(
        (passenger) => !passenger.main_passenger_id,
      ).length;
      const importedPassengers: Passenger[] = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const fallbackSerial = String(currentMainCount + index + 1);
        const serialNo = row.serialNo || fallbackSerial;
        const draftPassenger = createNewPassengerLocal(
          currentUser,
          [...currentBookingPassengers, ...importedPassengers],
          selectedTourData,
          availableHotels,
          {
            serial_no: serialNo,
            departureDate: effectiveDepartureDate,
            roomType: row.roomType || "",
            first_name: row.firstName,
            last_name: row.lastName,
            phone: row.phone,
          },
        );

        const resolvedRoomAllocation =
          row.roomAllocation ||
          (await assignRoomAllocation(
            [
              ...existingPassengers,
              ...currentBookingPassengers,
              ...importedPassengers,
              draftPassenger,
            ],
            draftPassenger,
            effectiveDepartureDate,
          ).catch(() => "M1"));

        importedPassengers.push({
          ...draftPassenger,
          serial_no: serialNo,
          tour_id: selectedTourData.id,
          tour_title: selectedTourData.title,
          departure_date: effectiveDepartureDate,
          name: `${row.firstName} ${row.lastName}`.trim(),
          first_name: row.firstName,
          last_name: row.lastName,
          email: row.email,
          phone: row.phone,
          emergency_phone: row.emergencyPhone || "",
          date_of_birth: row.dateOfBirth,
          age: row.age,
          gender: row.gender || null,
          nationality: row.nationality || "Mongolia",
          passport_number: row.passportNumber,
          passport_expire: row.passportExpire,
          roomType: row.roomType || "",
          room_allocation: resolvedRoomAllocation || "",
          hotel: row.hotel,
          additional_services: row.additionalServices,
          allergy: row.allergy || "",
          price: row.price,
          itinerary_status: row.itineraryStatus,
          has_baby_bed: row.hasBabyBed,
          updated_at: new Date().toISOString(),
        });
      }

      return importedPassengers;
    },
    [
      selectedTourData,
      effectiveDepartureDate,
      currentUser,
      availableHotels,
      existingPassengers,
    ],
  );

  const commitCsvImport = useCallback(
    async (
      previewRows: CsvPreviewRow[],
      ignoredServicesCount: number,
      options?: { includeWarningsNotice?: boolean },
    ): Promise<boolean> => {
      const rowsToImport = previewRows
        .filter((row) => row.status !== "blocked")
        .map((row) => row.data);

      if (rowsToImport.length === 0) {
        showNotification("error", t("csvNoRowsToImport"));
        return false;
      }

      if (
        !isPowerUser &&
        remainingSeats !== undefined &&
        rowsToImport.length > remainingSeats
      ) {
        showNotification(
          "error",
          t("csvImportExceedsSeats", {
            count: remainingSeats,
          }),
        );
        return false;
      }

      const importedPassengers = await importCsvRows(rowsToImport);

      if (importedPassengers.length === 0) {
        showNotification("error", t("csvNoRowsToImport"));
        return false;
      }

      setBookingPassengers((prev) => [...prev, ...importedPassengers]);
      setExpandedPassengerId(importedPassengers[0]?.id || null);
      clearCsvErrors();

      const warningCount = previewRows.filter((row) => row.status === "warning").length;
      const blockedCount = previewRows.filter((row) => row.status === "blocked").length;

      const messageParts = [
        t("csvImportedSuccess", {
          count: importedPassengers.length,
        }),
      ];

      if (ignoredServicesCount > 0) {
        messageParts.push(
          t("csvIgnoredUnknownServices", { count: ignoredServicesCount }),
        );
      }

      if (options?.includeWarningsNotice && warningCount > 0) {
        messageParts.push(t("csvImportedWithWarnings", { count: warningCount }));
      }

      if (blockedCount > 0) {
        messageParts.push(t("csvSkippedBlockedRows", { count: blockedCount }));
      }

      showNotification("success", messageParts.join(" "));
      return true;
    },
    [
      showNotification,
      t,
      isPowerUser,
      remainingSeats,
      importCsvRows,
      clearCsvErrors,
    ],
  );

  const handleConfirmCsvImport = useCallback(async () => {
    try {
      const success = await commitCsvImport(
        csvImportPreview.rows,
        csvImportPreview.ignoredServicesCount,
        {
          includeWarningsNotice: true,
        },
      );
      if (success) {
        resetCsvImportPreview();
      }
    } catch (error: unknown) {
      showNotification(
        "error",
        getErrorMessage(error, t("csvImportFailedGeneric")),
      );
    }
  }, [
    commitCsvImport,
    csvImportPreview.rows,
    csvImportPreview.ignoredServicesCount,
    resetCsvImportPreview,
    showNotification,
    t,
  ]);

  const handleCancelCsvImport = useCallback(() => {
    resetCsvImportPreview();
  }, [resetCsvImportPreview]);

  const handleUploadCSV = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const fileInput = event.target;
      const file = fileInput.files?.[0];

      if (!file) {
        return;
      }

      try {
        clearCsvErrors();
        resetCsvImportPreview();

        const { parsedRows, rowErrors, ignoredServicesCount } = await parseCsvRows(file);

        if (rowErrors.length > 0) {
          const maxErrors = 30;
          const visibleErrors = rowErrors.slice(0, maxErrors);
          const overflow = rowErrors.length - visibleErrors.length;

          setErrors(
            visibleErrors.map((message, index) => ({
              field: `csv_row_${index + 1}`,
              message,
            })),
          );

          showNotification(
            "error",
            overflow > 0
              ? t("csvImportFailedWithOverflow", {
                  first: visibleErrors[0],
                  count: overflow,
                })
              : t("csvImportFailedOne", { first: visibleErrors[0] }),
          );
          return;
        }

        if (parsedRows.length === 0) {
          showNotification("error", t("csvNoValidRows"));
          return;
        }

        const previewRows = createImportPreviewRows(parsedRows);
        const summary = {
          total: previewRows.length,
          ready: previewRows.filter((row) => row.status === "ready").length,
          warning: previewRows.filter((row) => row.status === "warning").length,
          blocked: previewRows.filter((row) => row.status === "blocked").length,
        };

        if (csvImportMode === "preview") {
          setCsvImportPreview({
            open: true,
            fileName: file.name,
            rows: previewRows,
            summary,
            ignoredServicesCount,
          });
          showNotification("success", t("csvPreviewReady"));
          return;
        }

        if (summary.blocked > 0) {
          const blockedRows = previewRows
            .filter((row) => row.status === "blocked")
            .slice(0, 30)
            .map((row, index) => ({
              field: `csv_row_${index + 1}`,
              message: t("csvBlockedRowSummary", {
                row: row.rowNumber,
                reason: row.blockers[0] || t("csvDuplicateFieldPassport"),
              }),
            }));

          setErrors(blockedRows);
          showNotification(
            "error",
            t("csvBlockedRowsFound", { count: summary.blocked }),
          );
          return;
        }

        await commitCsvImport(previewRows, ignoredServicesCount, {
          includeWarningsNotice: true,
        });
      } catch (error: unknown) {
        showNotification(
          "error",
          getErrorMessage(error, t("csvImportFailedGeneric")),
        );
      } finally {
        fileInput.value = "";
      }
    },
    [
      clearCsvErrors,
      resetCsvImportPreview,
      parseCsvRows,
      createImportPreviewRows,
      csvImportMode,
      commitCsvImport,
      t,
      showNotification,
      setErrors,
    ],
  );

  useEffect(() => {
    globalThis.__bookingPassengers = bookingPassengers;
  }, [bookingPassengers]);

  // === VALIDATION ===
  const validatePassenger = useCallback(
    (passenger: Passenger, depDate: string): ValidationError[] => {
      const errors: ValidationError[] = [];
      const { serial_no } = passenger;
      if (!passenger.first_name?.trim())
        errors.push({
          field: `passenger_${serial_no}_first_name`,
          message: t("bookingValidationFirstName", { serial: serial_no }),
        });
      if (!passenger.last_name?.trim())
        errors.push({
          field: `passenger_${serial_no}_last_name`,
          message: t("bookingValidationLastName", { serial: serial_no }),
        });
      if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
        errors.push({
          field: `passenger_${serial_no}_email`,
          message: t("bookingValidationEmail", { serial: serial_no }),
        });
      if (!passenger.phone?.trim())
        errors.push({
          field: `passenger_${serial_no}_phone`,
          message: t("bookingValidationPhone", { serial: serial_no }),
        });
      if (!passenger.nationality?.trim())
        errors.push({
          field: `passenger_${serial_no}_nationality`,
          message: t("bookingValidationNationality", { serial: serial_no }),
        });
      if (!passenger.date_of_birth?.trim())
        errors.push({
          field: `passenger_${serial_no}_date_of_birth`,
          message: t("bookingValidationDob", { serial: serial_no }),
        });
      if (!passenger.passport_number?.trim())
        errors.push({
          field: `passenger_${serial_no}_passport_number`,
          message: t("bookingValidationPassport", { serial: serial_no }),
        });
      if (!passenger.roomType?.trim())
        errors.push({
          field: `passenger_${serial_no}_roomType`,
          message: t("bookingValidationRoomType", { serial: serial_no }),
        });
      if (!passenger.hotel?.trim())
        errors.push({
          field: `passenger_${serial_no}_hotel`,
          message: t("bookingValidationHotel", { serial: serial_no }),
        });
      if (passenger.passport_expire) {
        const exp = cleanValueForDB(
          "passport_expire",
          passenger.passport_expire,
        );
        const dep = cleanValueForDB("departure_date", depDate);
        if (exp && dep) {
          const min = new Date(dep);
          min.setMonth(min.getMonth() + 6);
          if (new Date(exp) < min) {
            errors.push({
              field: `passenger_${serial_no}_passport_expire`,
              message: t("bookingValidationPassportExpiry", {
                serial: serial_no,
              }),
            });
          }
        }
      }
      return errors;
    },
    [t],
  );

  const validateBooking = useCallback(
    (step: number): boolean => {
      const allErrors: ValidationError[] = [];
      if (!selectedTour?.trim())
        allErrors.push({ field: "tour", message: t("bookingSelectTour") });
      if (!departureDate?.trim())
        allErrors.push({ field: "departure", message: t("bookingSelectDate") });
      if (step >= 3 && bookingPassengers.length === 0 && !leadPassengerData)
        allErrors.push({
          field: "passengers",
          message: t("bookingAddAtLeastOnePassenger"),
        });
      if (step === 4 && paymentMethod.length === 0)
        allErrors.push({ field: "payment", message: t("bookingSelectPaymentMethod") });

      if (strictGateRequired && !strictSeatRequestId) {
        allErrors.push({
          field: "seat_request",
          message: t("bookingSelectSeatRequestBeforeRegistration"),
        });
      }

      if (strictGateRequired && !strictSeatRequestCanBook) {
        allErrors.push({
          field: "seat_request",
          message: t("bookingSeatRequestNotEligibleCompleteDeposit"),
        });
      }

      bookingPassengers.forEach((p) =>
        allErrors.push(...validatePassenger(p, effectiveDepartureDate)),
      );
      setErrors(allErrors);
      return allErrors.length === 0;
    },
    [
      selectedTour,
      departureDate,
      bookingPassengers,
      paymentMethod,
      strictGateRequired,
      strictSeatRequestId,
      strictSeatRequestCanBook,
      leadPassengerData,
      validatePassenger,
      setErrors,
      effectiveDepartureDate,
      t,
    ],
  );

  // === SAVE ORDER ===
  const saveOrder = async () => {
    if (!validateBooking(4)) {
      showNotification("error", t("bookingFixValidationErrors"));
      return;
    }
    const tourData = selectedTourData;
    if (!tourData) return;

    if (strictGateRequired && !strictSeatRequestId) {
      showNotification(
        "error",
        t("bookingSeatRequestRequiredBeforeRegistration"),
      );
      return;
    }

    if (strictGateRequired && !strictSeatRequestCanBook) {
      showNotification(
        "error",
        t("bookingSeatRequestNotEligibleConfirmDeposit"),
      );
      return;
    }

    let bookingTourId = String(tourData.id || "").trim();

    if (strictGateRequired) {
      const requiredDate = normalizeDateOnly(strictSeatRequestTravelDate);
      const selectedDate = normalizeDateOnly(effectiveDepartureDate);

      if (requiredDate && selectedDate && requiredDate !== selectedDate) {
        showNotification(
          "error",
          t("bookingSelectedDateMustMatchSeatRequest"),
        );
        return;
      }

      const requestedSeatsLimit = Math.max(
        0,
        Math.floor(Number(strictSeatRequestSeats || 0) || 0),
      );
      if (requestedSeatsLimit > 0) {
        const seatsInSubmission = bookingPassengers.reduce(
          (sum, passenger) =>
            sum +
            Math.max(1, Math.floor(Number(passenger.seat_count || 1) || 1)),
          0,
        );

        if (seatsInSubmission > requestedSeatsLimit) {
          showNotification(
            "error",
            t("bookingSeatRequestLimitExceeded", {
              max: requestedSeatsLimit,
              submitted: seatsInSubmission,
            }),
          );
          return;
        }
      }
    }

    if (!isTourBookableInB2B(tourData)) {
      const remoteTourId = String(tourData.source_tour_id || tourData.id || "")
        .trim();

      if (!remoteTourId) {
        showNotification(
          "error",
          t("bookingGlobalTourIdMissing"),
        );
        return;
      }

      try {
        const ensured = await ensureGlobalTourBookable({
          remoteTourId,
        });

        if (ensured?.data?.localTourId) {
          bookingTourId = String(ensured.data.localTourId).trim();
        }
      } catch (backendSyncError) {
        showNotification(
          "error",
          getErrorMessage(backendSyncError, t("bookingGlobalTourSyncFailedRetry")),
        );
        return;
      }

      if (!bookingTourId) {
        showNotification(
          "error",
          t("bookingGlobalTourLinkFailedRetry"),
        );
        return;
      }
    }

    if (
      strictGateRequired &&
      strictSeatRequestTourId &&
      String(strictSeatRequestTourId).trim() !== bookingTourId
    ) {
      showNotification(
        "error",
        t("bookingSelectedTourMustMatchSeatRequest"),
      );
      return;
    }

    setLoading(true);
    try {
      // === CORRECT GROUPING LOGIC ===
      const groups: Passenger[][] = [];
      let currentGroup: Passenger[] = [];

      bookingPassengers.forEach((p, index) => {
        if (!p.main_passenger_id) {
          let wasLinkedFromPrevious = false;
          for (let j = index - 1; j >= 0; j--) {
            const prev = bookingPassengers[j];
            if (!prev.main_passenger_id) {
              wasLinkedFromPrevious = prev.is_related_to_next === true;
              break;
            }
          }

          if (currentGroup.length > 0 && !wasLinkedFromPrevious) {
            groups.push(currentGroup);
            currentGroup = [];
          }

          currentGroup.push(p);
        } else {
          currentGroup.push(p);
        }
      });

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      const isAgentLikeRole = ["agent", "provider", "subcontractor"].includes(
        String(currentUser.role || "")
          .trim()
          .toLowerCase(),
      );
      const useSharedBookingWrite =
        isPowerUser || strictGateRequired || isAgentLikeRole;
      const target = useSharedBookingWrite
        ? "passengers"
        : "passenger_requests";
      const savedOrders: Order[] = [];
      const sharedOrderStatus = isPowerUser ? "confirmed" : "pending";

      for (const group of groups) {
        const groupPrice = group.reduce((s, p) => s + (p.price || 0), 0);
        let realOrderId: string | number;

        if (useSharedBookingWrite) {
          const sharedResult = await createSharedBooking({
            userId: currentUser.id,
            tourId: bookingTourId,
            tourTitle: selectedTour,
            departureDate: effectiveDepartureDate,
            paymentMethod: paymentMethod[0] || null,
            orderStatus: sharedOrderStatus,
            source: "b2b",
            passengers: group,
          });
          realOrderId = sharedResult.orderId;
        } else {
          // Validate seat availability before creating booking
          const totalRequestedSeats = group.reduce((sum, p) => sum + (p.seat_count || 1), 0);
          if (totalRequestedSeats > 0) {
            const seatStats = await getDepartureSeatStats(bookingTourId, effectiveDepartureDate);
            if (seatStats.remaining < totalRequestedSeats) {
              throw new Error(
                t("bookingNotEnoughSeatsRequested", {
                  requested: totalRequestedSeats,
                  remaining: seatStats.remaining,
                }),
              );
            }
          }
          
          const { data: orderResult, error: orderError } = await supabase
            .from("orders")
            .insert({
              user_id: currentUser.id,
              tour_id: bookingTourId,
              departureDate: effectiveDepartureDate,
              total_price: groupPrice,
              status: "pending",
              payment_method: paymentMethod[0] || null,
              travel_choice: "Regular",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (orderError || !orderResult) {
            throw orderError || new Error(t("bookingOrderFailed"));
          }

          realOrderId = orderResult.id;

          for (const p of group) {
            const cleaned = {
              order_id: realOrderId,
              user_id: currentUser.id,
              tour_id: bookingTourId,
              tour_title: selectedTour,
              departure_date: effectiveDepartureDate
                ? cleanValueForDB("departure_date", effectiveDepartureDate)
                : null,
              name: `${p.first_name} ${p.last_name}`.trim(),
              room_allocation: p.room_allocation || "",
              serial_no: p.serial_no || "",
              passenger_number: p.passenger_number || `PAX-${Date.now()}`,
              last_name: p.last_name || "",
              first_name: p.first_name || "",
              date_of_birth: cleanValueForDB("date_of_birth", p.date_of_birth),
              age: p.age || null,
              gender: p.gender || null,
              passport_number: p.passport_number || "",
              passport_expire: cleanValueForDB(
                "passport_expire",
                p.passport_expire,
              ),
              nationality: p.nationality || "Mongolia",
              roomType: p.roomType || "",
              hotel: p.hotel || "",
              additional_services: p.additional_services || [],
              price: p.price || 0,
              email: p.email || "",
              phone: p.phone || "",
              passport_upload: p.passport_upload || null,
              allergy: p.allergy || "",
              emergency_phone: p.emergency_phone || "",
              status: "pending",
              is_blacklisted: false,
              notes: p.notes || "",
              seat_count: p.seat_count || 1,
              seat_request_id: strictGateRequired ? strictSeatRequestId : null,
              main_passenger_id: p.main_passenger_id || null,
              sub_passenger_count: p.sub_passenger_count || 0,
              has_sub_passengers: p.has_sub_passengers || false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              itinerary_status: p.itinerary_status || "No itinerary",
              pax_type: p.pax_type || "Adult",
              group_color: p.group_color || null,
            };

            const { error: passengerInsertError } = await supabase
              .from(target)
              .insert(cleaned);
            if (passengerInsertError) {
              throw passengerInsertError;
            }
          }
        }

        savedOrders.push({
          id: String(realOrderId),
          tour_title: selectedTour,
          departureDate: effectiveDepartureDate,
          total_price: groupPrice,
          status: useSharedBookingWrite ? sharedOrderStatus : "pending",
          payment_method: paymentMethod[0] || null,
          passenger_count: group.length,
        } as Order);
      }

      let globalSeatSyncWarning: string | null = null;
      const normalizedDepartureDate = normalizeDateOnly(effectiveDepartureDate);
      const remoteTourId = String(
        tourData.source_tour_id ||
          (tourData.source_tag === "global" ? tourData.id : ""),
      ).trim();
      const shouldSyncGlobalSeats =
        useSharedBookingWrite &&
        Boolean(bookingTourId) &&
        /^\d{4}-\d{2}-\d{2}$/.test(normalizedDepartureDate) &&
        (tourData.source_tag === "global" ||
          tourData.source_tag === "global+local" ||
          tourData.source_system === "global-travel" ||
          remoteTourId.length > 0);

      if (shouldSyncGlobalSeats) {
        try {
          const syncResult = await syncGlobalPriceRowCanonical({
            localTourId: bookingTourId,
            remoteTourId: remoteTourId || undefined,
            departureDate: normalizedDepartureDate,
          });

          if (syncResult?.data?.status === "skipped" && syncResult.data.reason) {
            globalSeatSyncWarning = syncResult.data.reason;
          }
        } catch (syncError) {
          globalSeatSyncWarning = getErrorMessage(
            syncError,
            t("bookingGlobalSeatSyncFailedAfterBooking"),
          );
        }
      }

      setOrders((prev) => [...prev, ...savedOrders]);
      const successMessage = t("bookingCreatedCount", { count: groups.length });
      showNotification(
        "success",
        globalSeatSyncWarning
          ? t("bookingCreatedWithGlobalSyncWarning", {
              message: successMessage,
              warning: globalSeatSyncWarning,
            })
          : successMessage,
      );
      resetBookingForm();
    } catch (error: any) {
      showNotification("error", error.message || t("bookingSaveFailed"));
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = bookingPassengers.reduce((s, p) => s + (p.price || 0), 0);

  const handleNextStep = useCallback(async () => {
    switch (activeStep) {
      case 1:
        if (!selectedTour || !departureDate) return;
        setActiveStep(2);
        break;
      case 2:
        setActiveStep(3);
        break;
      case 3:
        if (bookingPassengers.length === 0) return;
        if (validateBooking(activeStep)) setActiveStep(4);
        break;
      case 4:
        if (!loading && validateBooking(activeStep)) await saveOrder();
        break;
    }
  }, [
    activeStep,
    selectedTour,
    departureDate,
    bookingPassengers.length,
    validateBooking,
    loading,
    saveOrder,
  ]);

  return {
    bookingPassengers,
    activeStep,
    setActiveStep,
    paymentMethod,
    setPaymentMethod,
    loading,
    showInProvider,
    setShowInProvider,
    expandedPassengerId,
    setExpandedPassengerId,
    fieldLoading,
    canAdd,
    showPassengerPrompt,
    setShowPassengerPrompt,
    passengerCountInput,
    setPassengerCountInput,
    availableHotels,
    newPassengerRef,
    isPowerUser,
    selectedTourData,
    remainingSeats,
    totalPrice,
    addMultiplePassengers,
    updatePassenger,
    removePassenger,
    clearAllPassengers,
    resetBookingForm,
    handleDownloadCSV,
    handleUploadCSV,
    csvImportPreview,
    handleConfirmCsvImport,
    handleCancelCsvImport,
    handleNextStep,
    notification,
    setNotification,
    leadPassengerData,
    setLeadPassengerData,
    passengerFormData,
    setPassengerFormData,
    confirmLeadPassenger,
    setBookingPassengers,
  };
};
