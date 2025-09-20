export type Role = "user" | "provider" | "admin" | "superadmin" | "manager" | "pending";

export interface User {
  userId: string;
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: Role;
  phone: string;
  email: string;
  password: string;
  blacklist: boolean;
  company: string;
  access: "active" | "suspended"; // Match DB schema
  birth_date: string;
  id_card_number: string;
  travel_history: any[];
  passport_number: string;
  passport_expire: string;
  allergy: string;
  emergency_phone: string;
  membership_rank: string;
  membership_points: number;
  registered_by: string;
  createdBy: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export type UserRow = Omit<User, "createdAt" | "updatedAt" | "userId"> & {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: Role;
  status: "pending" | "approved" | "declined";
  phone: string | null;
  email: string;
  blacklist: boolean;
  company: string | null;
  access: "active" | "suspended";
  birth_date: string | null;
  id_card_number: string | null;
  travel_history: any[];
  passport_number: string | null;
  passport_expire: string | null;
  allergy: string | null;
  emergency_phone: string | null;
  membership_rank: string;
  membership_points: number;
  registered_by: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface Service {
  name: string;
  price: number;
  description?: string;
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  creator_name: string | null;
  tour_number: number | null;
  name: string;
  dates: string[];
  departure_date: string; // Maps to departuredate in database
  seats: number;
  available_seats?: number;
  hotels: string[];
  services: { name: string; price: number }[];
  price_base?: number; // Deprecated
  base_price: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status?: "active" | "inactive" | "full" | "hidden";
  show_in_provider?: boolean | null;
}

export interface Order {
  id: string; // ✅ Keep as string for bigserial compatibility
  user_id: string; // ✅ Use underscore for DB consistency
  tour_id: string;
  phone: string | null;
  last_name: string | null;
  first_name: string | null;
  email: string | null;
  age: number | null;
  gender: string | null;
  tour: string | null;
  passport_number: string | null;
  passport_expire: string | null;
  passport_copy: string | null;
  commission: number | null;
  created_by: string | null;
  edited_by: string | null;
  edited_at: string | null;
  travel_choice: string;
  status: OrderStatus;
  hotel: string | null;
  room_number: string | null;
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  departureDate: string; // ✅ Keep camelCase for React
  createdBy: string | null;
  total_price: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  show_in_provider: boolean;
  passengers: Passenger[]; // ✅ This is populated after creation
}

export type OrderStatus =
  | "pending"
  | "Information given"
  | "Need to give information"
  | "Need to tell got a seat/in waiting"
  | "Need to conclude a contract"
  | "Concluded a contract"
  | "Postponed the travel"
  | "Interested in other travel"
  | "Cancelled"
  | "Cancelled after confirmed"
  | "Cancelled after ordered a seat"
  | "Cancelled after take a information"
  | "Paid the advance payment"
  | "Need to meet"
  | "Sent a claim"
  | "Fam Tour"
  | "Confirmed"
  | "The travel is going"
  | "Travel ended completely"
  | "Has taken seat from another company"
  | "Swapped seat with another company"
  | "Gave seat to another company"
  | "Cancelled and bought travel from another country"
  | "Completed"; 

export type PaymentMethod =
  | "Cash"
  | "Bank"
  | "StorePay"
  | "Pocket"
  | "DariFinance"
  | "Hutul Nomuun"
  | "MonPay"
  | "Barter"
  | "Loan";

export interface Passenger {
  id: string; // uuid in DB
  order_id: string; // bigint in DB
  user_id: string | null; // uuid in DB, nullable
  tour_title: string;
  departure_date: string | null;
  name: string;
  room_allocation: string;
  serial_no: string;
  last_name: string;
  first_name: string;
  date_of_birth: string;
  age: number | null;
  gender: string | null;
  passport_number: string;
  passport_expiry: string | null;
  nationality: string;
  roomType: string; // Matches "roomType" in DB
  hotel: string;
  additional_services: string[];
  price: number;
  email: string;
  phone: string;
  passport_upload: string | null;
  allergy: string;
  emergency_phone: string;
  created_at: string; // timestamptz in DB
  updated_at: string; // timestamptz in DB
  status: "pending" | "approved" | "rejected" | "active" | "inactive" | "cancelled";
  is_blacklisted: boolean;
  blacklisted_date: string | null;
}

export interface PassengerRequest {
  id: string;
  order_id: string;
  user_id: string | null;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  roomType: string; // Matches "roomType" in DB
  hotel: string;
  status: string;
  created_at: string;
  tour_title: string; // From orders.travel_choice
  departure_date: string; // From orders.departureDate
  user_email: string; // From users.email
  user_first_name: string; // From users.first_name
  user_last_name: string; // From users.last_name
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
}

export interface TourWithAvailability extends Tour {
  booked_seats: number;
  available_seats: number;
  is_available: boolean;
}

export interface OrderSummary {
  id: string;
  tour_name: string;
  passenger_count: number;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
  created_by_name: string;
}

export interface UserStats {
  total_bookings: number;
  total_passengers: number;
  total_spent: number;
  active_bookings: number;
}

export interface ProviderStats {
  total_orders: number;
  total_passengers: number;
  total_commission: number;
  pending_orders: number;
  confirmed_orders: number;
}

export interface AdminStats {
  total_users: number;
  total_tours: number;
  total_orders: number;
  total_revenue: number;
  active_tours: number;
}

export interface TourFormData {
  title: string;
  description: string;
  name: string;
  departureDate: string;
  seats: string;
  hotels: string;
  services: string;
  price_base?: string;
}

export interface PassengerFormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  email: string;
  phone: string;
  roomType: string;
  hotel: string;
  additional_services: string[];
  allergy?: string;
  emergency_phone?: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormErrors {
  [key: string]: string | ValidationError[];
}

export type NotificationType = "success" | "error";

export interface Notification {
  type: NotificationType;
  message: string;
}

export interface ErrorType {
  field: string;
  message: string;
}

type TourOption = {
  id: string;
  title: string;
};
