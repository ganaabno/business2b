import { useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import type { User as UserType, Tour, Order, Passenger } from "../types/type";
import ToursTab from "../components/ToursTab";
import OrdersTab from "../components/OrdersTab";
import PassengersTab from "../components/PassengerTab";
import AddTourTab from "../components/AddTourTab";
import AddPassengerTab from "../components/AddPassengerTab";
import Notification from "../Parts/Notification";
import { usePassengers } from "../hooks/usePassengers";
import { useNotifications } from "../hooks/useNotifications";

interface ManagerInterfaceProps {
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  passengers: Passenger[];
  setPassengers: React.Dispatch<React.SetStateAction<Passenger[]>>;
  currentUser: UserType;
  onLogout: () => void;
}

export default function ManagerInterface({
  tours,
  setTours,
  orders,
  setOrders,
  passengers: initialPassengers,
  setPassengers,
  currentUser,
  onLogout,
}: ManagerInterfaceProps) {
  const [activeTab, setActiveTab] = useState<"tours" | "orders" | "addTour" | "passengers" | "addPassenger">("tours");
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const { notification, showNotification, setNotification } = useNotifications();
  const { passengers, errors, isGroup, setIsGroup, groupName, setGroupName, addPassenger, updatePassenger, removePassenger, validateBooking } = usePassengers(
    initialPassengers,
    setPassengers,
    currentUser,
    selectedTour,
    tours,
    showNotification
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage your tours, orders, and passengers efficiently</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m5 4v-7a3 3 0 00-3-3H5" />
            </svg>
            Logout
          </button>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {["tours", "orders", "addTour", "passengers", "addPassenger"].map((tab) => (
                <button
                  key={tab}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  onClick={() => setActiveTab(tab as "tours" | "orders" | "addTour" | "passengers" | "addPassenger")}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={tab === "tours" || tab === "addTour"
                          ? "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                          : tab === "orders"
                            ? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            : "M12 4v16m8-8H4"}
                      />
                      {tab !== "tours" && tab !== "addTour" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab === "orders" ? "M9 5a2 2 0 012-2h2a2 2 0 012 2" : "M15 11a3 3 0 11-6 0 3 3 0 016 0z"} />
                      )}
                    </svg>
                    <span>{tab === "addPassenger" ? "Add Passenger" : tab.charAt(0).toUpperCase() + tab.slice(1)}</span>
                    {tab !== "addTour" && tab !== "addPassenger" && (
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-semibold ml-2">
                        {tab === "tours" ? tours.length : tab === "orders" ? orders.length : passengers.length}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === "tours" && <ToursTab tours={tours} setTours={setTours} />}
        {activeTab === "orders" && <OrdersTab orders={orders} setOrders={setOrders} currentUser={currentUser} />}
        {activeTab === "passengers" && (
          <PassengersTab
            passengers={passengers}
            setPassengers={setPassengers}
            currentUser={currentUser}
            showNotification={showNotification}
          />
        )}
        {activeTab === "addTour" && <AddTourTab tours={tours} setTours={setTours} currentUser={currentUser} showNotification={showNotification} />}
        {activeTab === "addPassenger" && (
          <AddPassengerTab
            tours={tours}
            orders={orders}
            setOrders={setOrders}
            selectedTour={selectedTour}
            setSelectedTour={setSelectedTour}
            departureDate={departureDate}
            setDepartureDate={setDepartureDate}
            passengers={passengers}
            setPassengers={setPassengers}
            errors={errors}
            isGroup={isGroup}
            setIsGroup={setIsGroup}
            groupName={groupName}
            setGroupName={setGroupName}
            addPassenger={addPassenger}
            updatePassenger={updatePassenger}
            removePassenger={removePassenger}
            validateBooking={validateBooking}
            showNotification={showNotification}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
}