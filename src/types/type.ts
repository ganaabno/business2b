export type Role = "user" | "provider" | "admin" | "superadmin" | "manager";

export interface User {
  userId: string;
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role?: string;
  phone: string;
  email: string;
  password: string;
  blacklist: boolean;
  company: string;
  access: "active" | "suspended" | "pending";
  status: "pending" | "declined" | "approved";
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
  createdAt: string;
  updatedAt: string;
  auth_user_id?: string;
}

// Minimal UserType for UserInterface.tsx
export interface UserType {
  id: string;
  email: string;
  role?: string;
  username?: string;
}

export interface LeadPassenger {
  id: string;
  tour_id: string;
  tour_title: string | null;
  departure_date: string;
  last_name: string;
  first_name: string;
  phone: string;
  seat_count: number;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  expires_at: string;
  user_id: string;
}

export interface PassengerInLead {
  id: string;
  tour_id: string;
  tour_title: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  seat_count: number;
  departure_date: string;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  expires_at: string;
  user_id: string;
  created_by: string;
  tour: { title: string };
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
  description: string | null;
  creator_name: string | null;
  tour_number: string | null;
  name: string;
  dates: string[] | string | null;
  departure_date: string;
  seats: number;
  available_seats?: number;
  hotels: string[];
  services: { name: string; price: number }[];
  price_base?: number;
  base_price: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status?: "active" | "inactive" | "full" | "hidden" | "pending";
  show_in_provider?: boolean | null;
  booking_confirmation: {
    order_id: string;
    bus_number: string | null;
    guide_name: string | null;
    weather_emergency: string | null;
    updated_by: string | null;
    updated_by_email?: string;
    updated_by_username?: string;
    updated_at: string | null;
    passenger_count?: number;
  } | null;
}

export interface PendingUser {
  id: string;
  email: string;
  username: string;
  password: string;
  role_requested: "user" | "manager" | "provider";
  status: "pending" | "approved" | "declined";
  created_at: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export interface Order {
  id: string;
  user_id: string;
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
  passport_copy_url: string | null;
  commission: number | null;
  created_by: string | null;
  createdBy: string | null;
  edited_by: string | null;
  edited_at: string | null;
  travel_choice: string;
  status: OrderStatus;
  hotel: string | null;
  room_number: string | null; // Removed room_allocation, kept room_number
  payment_method: string | null;
  created_at: string;
  updated_at: string;
  passenger_count: number;
  departureDate: string;
  total_price: number;
  total_amount: number;
  paid_amount: number;
  balance: number;
  show_in_provider: boolean;
  order_id: string;
  booking_confirmation: {
    order_id: string;
    bus_number: string | null;
    guide_name: string | null;
    weather_emergency: string | null;
    updated_by: string | null;
    updated_at: string | null;
  } | null;
  passengers: Passenger[];
}

export interface BookingConfirmation {
  order_id: string;
  bus_number: string | null;
  guide_name: string | null;
  weather_emergency: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

export const VALID_ORDER_STATUSES = [
  "approved",
  "partially_approved",
  "rejected",
  "pending",
  "confirmed",
  "Information given",
  "Need to give information",
  "Need to tell got a seat/in waiting",
  "Need to conclude a contract",
  "Concluded a contract",
  "Postponed the travel",
  "Interested in other travel",
  "Cancelled after confirmed",
  "Cancelled after ordered a seat",
  "Cancelled after take a information",
  "Paid the advance payment",
  "Need to meet",
  "Sent a claim",
  "Fam Tour",
  "The travel is going",
  "Has taken seat from another company",
  "Swapped seat with another company",
  "Gave seat to another company",
  "Cancelled and bought travel from another country",
  "Completed",
  "Travel ended completely",
  "cancelled",
] as const;

export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];

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
  user_id: string | null;
  tour_title: string;
  tour_id: string;
  departure_date: string | null;
  name?: string;
  room_allocation: string;
  serial_no: string;
  last_name: string;
  first_name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  passport_number: string;
  passport_expire: string | null;
  nationality: string;
  roomType: string;
  hotel: string;
  additional_services: string[];
  price: number;
  email: string;
  phone: string;
  passport_upload: string | null;
  allergy: string;
  emergency_phone: string;
  created_at: string;
  updated_at: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "active"
    | "inactive"
    | "cancelled";
  is_blacklisted: boolean;
  blacklisted_date: string | null;
  notes: string;
  seat_count?: number | null;
  main_passenger_id: string | null;
  sub_passenger_count: number;
  has_sub_passengers: boolean;
  passenger_number: string;
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
  passport_expire: string;
  roomType: string;
  hotel: string;
  status: string;
  created_at: string;
  tour_title: string;
  departure_date: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  passenger: Passenger[];
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
  tour_id: string;
  departure_date: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  nationality: string;
  passport_number: string;
  passport_expire: string;
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
  field?: string;
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

export interface UseBookingReturn {
  bookingPassengers: Passenger[];
  activeStep: number;
  setActiveStep: React.Dispatch<React.SetStateAction<number>>;
  paymentMethod: string;
  setPaymentMethod: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  showInProvider: boolean;
  setShowInProvider: React.Dispatch<React.SetStateAction<boolean>>;
  expandedPassengerId: string | null;
  setExpandedPassengerId: React.Dispatch<React.SetStateAction<string | null>>;
  fieldLoading: Record<string, boolean>;
  canAdd: boolean;
  showPassengerPrompt: boolean;
  setShowPassengerPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  passengerCountInput: string;
  setPassengerCountInput: React.Dispatch<React.SetStateAction<string>>;
  availableHotels: string[];
  newPassengerRef: React.MutableRefObject<HTMLDivElement | null>;
  isPowerUser: boolean;
  selectedTourData?: Tour;
  remainingSeats?: number;
  totalPrice: number;
  addMultiplePassengers: (count: number) => void;
  updatePassenger: (index: number, field: string, value: any) => Promise<void>;
  removePassenger: (index: number) => void;
  clearAllPassengers: () => void;
  resetBookingForm: () => void;
  handleDownloadCSV: () => void;
  handleUploadCSV: (file: File) => Promise<void>;
  handleNextStep: () => Promise<void>;
  MAX_PASSENGERS: number;
  notification: NotificationType | null;
  setNotification: React.Dispatch<
    React.SetStateAction<NotificationType | null>
  >;
  leadPassengerData: LeadPassenger | null;
  setLeadPassengerData: React.Dispatch<
    React.SetStateAction<LeadPassenger | null>
  >;
  passengerFormData: any;
  setPassengerFormData: React.Dispatch<React.SetStateAction<any>>;
  confirmLeadPassenger: () => void;
}
