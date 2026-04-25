import type { UserType, Passenger, Tour } from "../types/type";
import { isValid } from "date-fns";

export const cleanDateForDB = (dateValue: any): string | null => {
  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === "" ||
    dateValue === " " ||
    (typeof dateValue === "string" && dateValue.trim() === "")
  ) {
    return null;
  }

  const cleaned = String(dateValue).trim();
  const parsedDate = new Date(cleaned);

  if (isNaN(parsedDate.getTime())) {
    return null;
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const cleanValueForDB = (field: string, value: any): any => {
  const dateFields = [
    "date_of_birth",
    "passport_expire",
    "departureDate",
    "blacklisted_date",
  ];
  if (dateFields.includes(field)) {
    return cleanDateForDB(value);
  }
  if (["created_at", "updated_at"].includes(field)) {
    return value ? new Date(value).toISOString() : null;
  }
  return typeof value === "string" ? value.trim() : value;
};

export const generatePassengerId = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  selectedTourData?: Tour,
  hotels: string[] = [],
  prefill: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    main_passenger_id?: string | null;
  } = {},
  effectiveDepartureDate?: string
): Passenger => {
  const now = new Date().toISOString();
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || "user"
  );
  const mainPassengerCount =
    existingPassengers.filter((p) => !p.main_passenger_id).length + 1;
  const serialNo = prefill.main_passenger_id
    ? existingPassengers.find((p) => p.id === prefill.main_passenger_id)
        ?.serial_no || mainPassengerCount.toString()
    : mainPassengerCount.toString();
  const defaultHotel = hotels.length > 0 ? hotels[0] : "";

  return {
    id: generatePassengerId(),
    order_id: null,
    user_id: currentUser.id || null,
    tour_id: selectedTourData?.id || "",
    tour_title: selectedTourData?.title || "",
    departure_date: effectiveDepartureDate || null,
    name:
      prefill.first_name && prefill.last_name
        ? `${prefill.first_name} ${prefill.last_name}`.trim()
        : undefined,
    room_allocation: "",
    serial_no: serialNo,
    passenger_number: `PAX-${serialNo}`,
    last_name: prefill.last_name || "",
    first_name: prefill.first_name || "",
    date_of_birth: "",
    age: null,
    gender: null,
    passport_number: "",
    passport_expire: null,
    nationality: "Mongolia",
    roomType: "",
    hotel: defaultHotel,
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: prefill.phone || "",
    passport_upload: null,
    allergy: "",
    emergency_phone: "",
    created_at: now,
    updated_at: now,
    status: isPowerUser ? "active" : "pending",
    is_blacklisted: false,
    blacklisted_date: null,
    notes: "",
    seat_count: 1,
    main_passenger_id: prefill.main_passenger_id || null,
    sub_passenger_count: 0,
    has_sub_passengers: false,
    booking_number: null,
    pax_type: "Adult",
    orders: null,
    note: "",
    is_request: undefined,
  };
};

export function createNewPassengerLocal(
  user: UserType,
  passengers: Passenger[],
  tourData: Tour | undefined,
  hotels: string[],
  extraFields: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    main_passenger_id?: string | null;
    roomType?: string;
    room_allocation?: string;
    serial_no?: string; // 🚀 This is passed but not used properly!
    departureDate?: string;
  } = {}
): Passenger {
  const now = new Date().toISOString();
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    user.role || "user"
  );

  // 🚀 FIX: Use the provided serial_no from extraFields FIRST
  const serialNo =
    extraFields.serial_no ||
    (extraFields.main_passenger_id
      ? passengers.find((p) => p.id === extraFields.main_passenger_id)
          ?.serial_no
      : (passengers.filter((p) => !p.main_passenger_id).length + 1).toString());

  const defaultHotel = hotels.length > 0 ? hotels[0] : "";

  return {
    id: generatePassengerId(),
    order_id: null,
    user_id: user.id || null,
    tour_id: tourData?.id || "",
    tour_title: tourData?.title || "",
    departure_date: extraFields.departureDate || "",
    name:
      extraFields.first_name && extraFields.last_name
        ? `${extraFields.first_name} ${extraFields.last_name}`.trim()
        : undefined,
    room_allocation: extraFields.room_allocation || "",
    serial_no: serialNo, // 🚀 Now this will use the main passenger's serial_no
    passenger_number: `PAX-${serialNo}`,
    last_name: extraFields.last_name || "",
    first_name: extraFields.first_name || "",
    date_of_birth: "",
    age: null,
    gender: null,
    passport_number: "",
    passport_expire: null,
    nationality: "Mongolia",
    roomType: extraFields.roomType || "", // 🚀 This should use main's room type
    hotel: defaultHotel,
    additional_services: [],
    price: tourData?.base_price || 0,
    email: "",
    phone: extraFields.phone || "",
    passport_upload: null,
    allergy: "",
    emergency_phone: "",
    created_at: now,
    updated_at: now,
    status: isPowerUser ? "active" : "pending",
    is_blacklisted: false,
    blacklisted_date: null,
    notes: "",
    seat_count: 1,
    main_passenger_id: extraFields.main_passenger_id || null,
    sub_passenger_count: 0,
    has_sub_passengers: false,
    booking_number: null,
    pax_type: "Adult",
    orders: null,
    note: "",
    is_request: undefined,
  };
}
