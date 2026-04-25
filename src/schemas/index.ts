import { z } from "zod";

export const passengerSchema = z.object({
  id: z.string().optional(),
  order_id: z.string().optional(),
  tour_id: z.string().min(1, "Tour is required"),
  departure_date: z.string().min(1, "Departure date is required"),
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name is too long"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name is too long"),
  date_of_birth: z.string().optional().nullable(),
  age: z.number().optional().nullable(),
  gender: z.string().min(1, "Gender is required"),
  nationality: z.string().min(1, "Nationality is required"),
  passport_number: z
    .string()
    .min(1, "Passport number is required")
    .max(20, "Passport number is too long"),
  passport_expire: z.string().min(1, "Passport expiry date is required"),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .max(20, "Phone number is too long"),
  roomType: z.string().min(1, "Room type is required"),
  hotel: z.string().optional().nullable(),
  additional_services: z.array(z.string()).default([]),
  price: z.number().optional().nullable(),
  allergy: z.string().optional().nullable(),
  emergency_phone: z.string().optional().nullable(),
  status: z
    .enum(["pending", "approved", "rejected", "active", "inactive", "cancelled", "completed"])
    .default("pending"),
  pax_type: z.enum(["Adult", "Child", "Infant"]).default("Adult"),
});

export const leadPassengerSchema = z.object({
  id: z.string().optional(),
  tour_id: z.string().min(1, "Tour is required"),
  departure_date: z.string().min(1, "Departure date is required"),
  last_name: z.string().min(1, "Last name is required"),
  first_name: z.string().min(1, "First name is required"),
  phone: z.string().min(1, "Phone number is required"),
  seat_count: z
    .number()
    .min(1, "At least 1 seat is required")
    .max(20, "Maximum 20 seats per booking"),
});

export const userSchema = z.object({
  id: z.string().optional(),
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  role: z.enum(["user", "provider", "admin", "superadmin", "manager", "subcontractor", "agent"]).default("user"),
  company: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  id_card_number: z.string().optional().nullable(),
  passport_number: z.string().optional().nullable(),
  passport_expire: z.string().optional().nullable(),
  emergency_phone: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  username: z.string().min(3, "Username must be at least 3 characters"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  role: z.enum(["user", "subcontractor", "agent"]).default("user"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const tourSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Tour title is required").max(200),
  description: z.string().optional().nullable(),
  departure_date: z.string().min(1, "Departure date is required"),
  seats: z.number().min(1, "At least 1 seat is required").max(500),
  base_price: z.number().min(0, "Price cannot be negative"),
  hotels: z.array(z.string()).default([]),
  services: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })).default([]),
  country: z.string().optional().nullable(),
  duration_day: z.number().optional().nullable(),
  duration_night: z.number().optional().nullable(),
  is_featured: z.boolean().default(false),
  status: z.enum(["active", "inactive", "full", "completed", "hidden", "pending"]).default("active"),
});

export const orderSchema = z.object({
  id: z.string().optional(),
  tour_id: z.string().min(1, "Tour is required"),
  user_id: z.string().min(1, "User is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().min(1, "Phone number is required"),
  passenger_count: z.number().min(1, "At least 1 passenger is required"),
  total_amount: z.number().min(0, "Amount cannot be negative"),
  payment_method: z.string().optional().nullable(),
  travel_choice: z.string().optional().nullable(),
  hotel: z.string().optional().nullable(),
  room_number: z.string().optional().nullable(),
  status: z.string().default("pending"),
  note: z.string().optional().nullable(),
});

export const bookingConfirmationSchema = z.object({
  order_id: z.string().min(1, "Order is required"),
  bus_number: z.string().optional().nullable(),
  guide_name: z.string().optional().nullable(),
  weather_emergency: z.string().optional().nullable(),
});

export type PassengerInput = z.infer<typeof passengerSchema>;
export type LeadPassengerInput = z.infer<typeof leadPassengerSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type TourInput = z.infer<typeof tourSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type BookingConfirmationInput = z.infer<typeof bookingConfirmationSchema>;
