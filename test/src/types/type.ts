
export interface User {
  username: string;
  password: string;
  role: "superadmin" | "admin" | "user" | "provider";
  company?: string;
  access: "active" | "suspended";
  createdBy: string;
  createdAt: string;
  lastLogin: string | null;
}

export interface Tour {
  name: string;
  dates: string[];
  seats: number;
  hotels: string[];
  services: { name: string; price: number }[];
  createdBy: string;
  createdAt: string;
}

export interface Order {
  tour: string;
  departureDate: string;
  passengers: Passenger[];
}

export interface Passenger {
  roomAllocation: string;
  serialNo: string;
  lastName: string;
  firstName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  passportNumber: string;
  passportExpiry: string;
  nationality: string;
  roomType: string;
  hotel: string;
  additionalServices: string[];
  price: number;
  email: string;
  phone: string;
  passportUpload?: File;
}