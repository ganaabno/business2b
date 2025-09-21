import type { Tour, Passenger, User as UserType } from "../types/type";

export const generatePassengerId = (): string =>
  `passenger_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

export const createNewPassenger = (
  currentUser: UserType,
  existingPassengers: Passenger[],
  isGroup: boolean,
  groupName: string,
  selectedTourData?: Tour
): Passenger => {
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

  const inheritedDetails =
    isGroup && lastPassenger
      ? {
          nationality: lastPassenger.nationality,
          hotel: lastPassenger.hotel,
          emergency_phone: lastPassenger.emergency_phone,
        }
      : {
          nationality: "Mongolia",
          hotel: "",
          emergency_phone: "",
        };

  return {
    id: generatePassengerId(),
    order_id: "",
    user_id: currentUser.userId || currentUser.id, // Handle both UserInterface and AddPassengerTab
    name: "",
    room_allocation: "",
    serial_no: serialNo,
    last_name: "",
    first_name: "",
    date_of_birth: "",
    age: 0,
    gender: "",
    passport_number: "",
    passport_expiry: "",
    nationality: inheritedDetails.nationality,
    roomType: defaultRoomType,
    hotel: inheritedDetails.hotel,
    additional_services: [],
    price: selectedTourData?.base_price || 0,
    email: "",
    phone: "",
    passport_upload: "",
    allergy: "",
    emergency_phone: inheritedDetails.emergency_phone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "active",
    tour_title: selectedTourData?.title || "",
    departure_date: selectedTourData?.departure_date || "",
    is_blacklisted: false,
    blacklisted_date: "",
  };
};

export function formatDisplayDate(s: string | undefined): string {
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

export const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()))
    age--;
  return age;
};

export const calculateServicePrice = (
  services: string[],
  tourData: Tour
): number => {
  return services.reduce((sum, serviceName) => {
    const service = tourData.services.find((s) => s.name === serviceName);
    return sum + (service ? service.price : 0);
  }, 0);
};

export const getPassportExpiryColor = (expiryDate: string): string => {
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

export const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "Not set";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Invalid date";
  }
};
