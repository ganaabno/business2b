import type { UserType, Passenger, Tour } from "../types/type";
import { parse, isValid } from "date-fns";

export const cleanDateForDB = (dateValue: any): string | null => {
  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === "" ||
    dateValue === " " ||
    (typeof dateValue === "string" && dateValue.trim() === "") ||
    (typeof dateValue === "string" &&
      !isNaN(Date.parse(dateValue)) &&
      new Date(dateValue).toString() === "Invalid Date")
  ) {
    return null;
  }
  const cleaned = String(dateValue).trim();
  const parsedDate = new Date(cleaned);
  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
    const day = String(parsedDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
};

export const cleanValueForDB = (field: string, value: any): any => {
  if (
    [
      "date_of_birth",
      "passport_expire",
      "departure_date",
      "blacklisted_date",
    ].includes(field)
  ) {
    return cleanDateForDB(value);
  }
  if (["created_at", "updated_at"].includes(field)) {
    return value ? new Date(value).toISOString() : null;
  }
  if (field === "departureDate") {
    return cleanDateForDB(value);
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
  } = {}
): Passenger => {
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    currentUser.role || "user"
  );
  const serialNo = (existingPassengers.length + 1).toString();
  const lastPassenger = existingPassengers[existingPassengers.length - 1];

  const defaultRoomType = (() => {
    if (existingPassengers.length === 0) return "";
    if (
      lastPassenger?.roomType === "Double" &&
      existingPassengers.length % 2 === 1
    ) {
      return "Double";
    }
    return "";
  })();

  const defaultHotel = hotels.length > 0 ? hotels[0] : "";

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.id || null,
    tour_id: selectedTourData?.id || "",
    tour_title: selectedTourData?.title || "",
    departure_date: null,
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
    roomType: defaultRoomType,
    hotel: defaultHotel,
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: prefill.phone || "",
    passport_upload: null,
    allergy: "",
    emergency_phone: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: isPowerUser ? "active" : "pending",
    is_blacklisted: false,
    blacklisted_date: null,
    notes: "",
    seat_count: 1,
    main_passenger_id: prefill.main_passenger_id || null,
    sub_passenger_count: 0,
    has_sub_passengers: false,
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
    serial_no?: string;
  } = {}
): Passenger {
  const isPowerUser = ["admin", "manager", "superadmin"].includes(
    user.role || "user"
  );
  const baseSerial = (passengers.length + 1).toString();
  const defaultHotel = hotels.length > 0 ? hotels[0] : "";

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: user.id || null,
    tour_id: tourData?.id || "",
    tour_title: tourData?.title || "",
    departure_date: null,
    name:
      extraFields.first_name && extraFields.last_name
        ? `${extraFields.first_name} ${extraFields.last_name}`.trim()
        : undefined,
    room_allocation: extraFields.room_allocation || "",
    serial_no: extraFields.serial_no || baseSerial,
    passenger_number: `PAX-${baseSerial}`,
    last_name: extraFields.last_name || "",
    first_name: extraFields.first_name || "",
    date_of_birth: "",
    age: null,
    gender: null,
    passport_number: "",
    passport_expire: null,
    nationality: "Mongolia",
    roomType: extraFields.roomType || "",
    hotel: defaultHotel,
    additional_services: [],
    price: tourData?.base_price || 0,
    email: "",
    phone: extraFields.phone || "",
    passport_upload: null,
    allergy: "",
    emergency_phone: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: isPowerUser ? "active" : "pending",
    is_blacklisted: false,
    blacklisted_date: null,
    notes: "",
    seat_count: 1,
    main_passenger_id: extraFields.main_passenger_id || null,
    sub_passenger_count: 0,
    has_sub_passengers: false,
  };
}
