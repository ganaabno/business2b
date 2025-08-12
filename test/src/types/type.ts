export interface User {
  id: string;
  userId: string;
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
  id: string;
  title: string;
  description: string;
  name: string;
  dates: string[];
  seats: number;
  hotels: string[];
  services: { name: string; price: number }[];
  createdBy: string;
  createdAt: string;
}

export interface Order {
  id: string;
  tourId: string;
  userId: string;
  status: string;
  tour: string;
  departureDate: string;
  passengers: Passenger[];
  createdBy: string;
  createdAt: string;
}

export interface Passenger {
  id: string;
  userId: string;
  name: string;
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