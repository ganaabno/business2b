export type Role = "user" | "provider" | "admin" | "superadmin";

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
  access: string;
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
  createdAt: Date;
  updatedAt: Date;
}

// Only include fields from the DB table; convert timestamps to string
export type UserRow = Omit<User, "createdAt" | "updatedAt" | "userId"> & {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: "user" | "provider" | "admin" | "superadmin";
  phone: string | null;
  email: string;
  password: string;
  blacklist: boolean;
  company: string | null;
  access: string;
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
  name: string;
  dates: string[];
  departure_date: string; // Add this line
  seats: number;
  available_seats?: number;
  hotels: string[];
  services: Service[];
  price_base?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'inactive' | 'full';
}

export interface Order {
  id: string;
  user_id: string;
  tour_id: string;
  phone: string;
  last_name: string;
  first_name: string;
  age: number;
  gender: string;
  tour: string;
  passport_number: string;
  passport_expire: string;
  passport_copy: string;
  commission: number;
  created_by: string;
  edited_by: string | null;
  edited_at: string | null;
  travel_choice: string;
  status: OrderStatus;
  hotel: string;
  room_number: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  passengers: Passenger[];
  departureDate: string;
  createdBy: string;
  total_amount?: number; // Total order amount
  total_price?: number; // Alternative field for total price
  paid_amount?: number; // Amount paid
  balance?: number; // Remaining balance
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
  | "Cancelled and bought travel from another country";

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
  id: string;
  order_id: string;
  user_id: string;
  name: string;
  room_allocation: string;
  serial_no: string;
  last_name: string;
  first_name: string;
  date_of_birth: string;
  age: number;
  gender: string;
  passport_number: string;
  passport_expiry: string;
  nationality: string;
  roomType: string;
  hotel: string;
  additional_services: string[];
  price: number;
  email: string;
  phone: string;
  passport_upload: string;
  allergy: string;
  emergency_phone: string;
  created_at: string;
  updated_at: string;
  status?: 'active' | 'cancelled'; // Passenger status
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: Role;
}

// Utility types for better data handling
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

// Form interfaces for better type safety
export interface TourFormData {
  title: string;
  description: string;
  name: string;
  departure_date: string;
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

// API Response types
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

// Validation and Error types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormErrors {
  [key: string]: string | ValidationError[];
}