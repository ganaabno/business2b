// src/MockLogin.tsx
import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import type { User as UserType, Tour, Order } from "./types/type";
import AdminInterface from "./components/AdminInterface";
import UserInterface from "./components/UserInterface";
import ProviderInterface from "./components/ProviderInterface";

// Example mock data (replace with your actual mock arrays)
export const mockUsers: UserType[] = [
  {
    userId: "1111",
    id: "1111",
    first_name: "Super",
    last_name: "Admin",
    username: "super",
    role: "superadmin",
    phone: "",
    email: "",
    password: "",
    blacklist: false,
    company: "",
    access: "",
    birth_date: "",
    id_card_number: "",
    travel_history: [],
    passport_number: "",
    passport_expire: "",
    allergy: "",
    emergency_phone: "",
    membership_rank: "",
    membership_points: 0,
    registered_by: "",
    createdBy: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    userId: "2222",
    id: "2222",
    first_name: "Normal",
    last_name: "User",
    username: "user1",
    role: "user",
    phone: "",
    email: "",
    password: "",
    blacklist: false,
    company: "",
    access: "",
    birth_date: "",
    id_card_number: "",
    travel_history: [],
    passport_number: "",
    passport_expire: "",
    allergy: "",
    emergency_phone: "",
    membership_rank: "",
    membership_points: 0,
    registered_by: "",
    createdBy: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    userId: "3333",
    id: "3333",
    first_name: "Provider",
    last_name: "Guy",
    username: "provider1",
    role: "provider",
    phone: "222-222-2222",
    email: "provider@example.com",
    password: "providerpass",
    blacklist: false,
    company: "ProviderCo",
    access: "active",
    birth_date: "1985-01-01",
    id_card_number: "",
    travel_history: [],
    passport_number: "",
    passport_expire: "",
    allergy: "",
    emergency_phone: "",
    membership_rank: "standard",
    membership_points: 0,
    registered_by: "",
    createdBy: "3333",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export const mockTours: Tour[] = [
  {
    id: "t1",
    title: "Tour 1",
    description: "Description of Tour 1",
    name: "Tour One",
    dates: ["2025-08-15"],
    seats: 10,
    hotels: ["Hotel A"],
    services: [{ name: "Breakfast", price: 20 }],
    created_by: "1111",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockOrders: Order[] = [
  {
    id: "o1",
    user_id: "2222",
    tour_id: "t1",
    phone: "",
    last_name: "User",
    first_name: "Normal",
    age: 25,
    gender: "M",
    tour: "Tour One",
    passport_number: "",
    passport_expire: "",
    passport_copy: "",
    commission: 0,
    created_by: "1111",
    edited_by: "1111",
    edited_at: new Date().toISOString(),
    travel_choice: "Option1",
    status: "pending",
    hotel: "Hotel A",
    room_number: "101",
    payment_method: "cash",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    passengers: [],
    departureDate: new Date().toISOString(),
    createdBy: "1111",
  },
];

interface MockLoginProps {
  users: UserType[];
  setUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

export default function MockLogin({
  users,
  setUsers,
  tours,
  setTours,
  orders,
  setOrders,
}: MockLoginProps) {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);

  if (!currentUser) {
    return (
      <div className="p-8 flex flex-col gap-4">
        <h2 className="text-xl font-bold">Select a mock user to login:</h2>
        {mockUsers.map((user) => (
          <button
            key={user.userId}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setCurrentUser(user)}
          >
            {user.username} ({user.role})
          </button>
        ))}
      </div>
    );
  }

  // Wrap interfaces in BrowserRouter so useNavigate works
  return (
    <BrowserRouter>
      {currentUser.role === "superadmin" || currentUser.role === "admin" ? (
        <AdminInterface
          users={users || mockUsers}
          setUsers={setUsers || (() => { })}
          tours={tours || mockTours}
          setTours={setTours || (() => { })}
          orders={orders || mockOrders}
          setOrders={setOrders || (() => { })}
          currentUser={currentUser}
          onLogout={() => setCurrentUser(null)}
        />
      ) : currentUser.role === "user" ? (
        <UserInterface
          tours={tours || mockTours}
          orders={orders || mockOrders}
          setOrders={setOrders || (() => { })}
          currentUser={currentUser}
          onLogout={() => setCurrentUser(null)}
        />
      ) : (
        <ProviderInterface
          tours={tours || mockTours}
          setTours={setTours || (() => { })}
          orders={orders || mockOrders}
          setOrders={setOrders || (() => { })}
          currentUser={currentUser}
          onLogout={() => setCurrentUser(null)}
        />
      )}
    </BrowserRouter>
  );
}
