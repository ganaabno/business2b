// utils/bookingUtils.ts
import type { Passenger, Tour, User as UserType } from "../types/type";

export const cleanDateForDB = (dateValue: any): string | null => {
  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === "" ||
    dateValue === " " ||
    (typeof dateValue === "string" && dateValue.trim() === "") ||
    (typeof dateValue === "string" && !isNaN(Date.parse(dateValue)) && new Date(dateValue).toString() === "Invalid Date")
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
  if (["date_of_birth", "passport_expire", "departure_date", "blacklisted_date"].includes(field)) {
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
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  selectedTourData?: Tour,
  hotels: string[] = []
): Passenger => {
  const serialNo = (existingPassengers.length + 1).toString();
  const lastPassenger = existingPassengers[existingPassengers.length - 1];

  const defaultRoomType = (() => {
    if (existingPassengers.length === 0) return "";
    if (lastPassenger?.roomType === "Double" && existingPassengers.length % 2 === 1) {
      return "Double";
    }
    return "";
  })();

  const defaultHotel = hotels.length > 0 ? hotels[0] : "";

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.id,
    name: "",
    tour_title: selectedTourData?.title || "",
    departure_date: selectedTourData?.departure_date || "",
    room_allocation: "",
    serial_no: serialNo,
    last_name: "",
    first_name: "",
    date_of_birth: "",
    age: 0,
    gender: "",
    passport_number: "",
    passport_expire: null,
    nationality: "Mongolia",
    roomType: defaultRoomType,
    hotel: defaultHotel,
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: "",
    passport_upload: "",
    allergy: "",
    emergency_phone: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "active",
    is_blacklisted: false,
    blacklisted_date: null,
    notes: "",
  };
};