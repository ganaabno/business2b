export interface User {
  userId: string;
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  role: "user" | "admin" | "provider" | "superadmin";
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
  createdBy: string; // Changed from createdBy
  createdAt: Date; // Changed from createdAt
  updatedAt: Date; // Changed from updatedAt
}

export interface Tour {
  id: string;
  title: string;
  description: string;
  name: string;
  dates: string[];
  seats: number;
  hotels: string[];
  services: { name: string; price: number }[];
  created_by: string;
  created_at: string;
  updated_at: string;
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
  tour: string; // Consider removing if redundant with travel_choice
  passport_number: string;
  passport_expire: string;
  passport_copy: string;
  commission: number;
  created_by: string;
  edited_by: string;
  edited_at: string;
  travel_choice: string;
  status: string;
  hotel: string;
  room_number: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
  passengers: Passenger[];
  departureDate: string; // Changed from departureDate
  createdBy: string; // Consider removing if redundant with created_by
}

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
  roomType: string; // Changed from roomType
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
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'superadmin' | 'admin' | 'provider' | 'user';
}
