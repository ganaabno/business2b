import type { Passenger, Tour, ValidationError } from "../types/type";

export const validatePassenger = (passenger: Passenger): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!passenger.first_name?.trim()) errors.push({ field: "first_name", message: "First name is required" });
  if (!passenger.last_name?.trim()) errors.push({ field: "last_name", message: "Last name is required" });
  if (!passenger.email?.trim() || !/\S+@\S+\.\S+/.test(passenger.email))
    errors.push({ field: "email", message: "Valid email is required" });
  if (!passenger.phone?.trim()) errors.push({ field: "phone", message: "Phone number is required" });
  if (!passenger.nationality) errors.push({ field: "nationality", message: "Nationality is required" });
  if (!passenger.gender) errors.push({ field: "gender", message: "Gender is required" });
  if (!passenger.passport_number?.trim()) errors.push({ field: "passport_number", message: "Passport number is required" });
  if (!passenger.passport_expiry) errors.push({ field: "passport_expiry", message: "Passport expiry date is required" });
  if (!passenger.roomType) errors.push({ field: "roomType", message: "Room type is required" });
  if (!passenger.hotel) errors.push({ field: "hotel", message: "Hotel selection is required" });
  return errors;
};

export const calculateAge = (dateOfBirth: string): number => {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
};

export const calculateServicePrice = (services: string[], tourData: Tour): number => {
  return services.reduce((sum, serviceName) => {
    const service = tourData.services?.find((s) => s.name === serviceName);
    return sum + (service ? service.price : 0);
  }, 0);
};