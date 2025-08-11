export interface User {
  username: string;
  password: string;
  role: "superadmin" | "admin" | "user" | "provider";
  access: "active" | "suspended";
  createdBy: string;
  createdAt: string;
  lastLogin: string | null;
  company?: string;
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

export interface Order {
  tour: string;
  departureDate: string;
  passengers: Passenger[];
  createdBy: string;
  createdAt: string;
}
