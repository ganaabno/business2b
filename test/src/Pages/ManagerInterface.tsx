import { useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import type { User as UserType, Tour, Order, Passenger } from "../types/type";
import ToursTab from "../components/ToursTab";
import OrdersTab from "../components/OrdersTab";
import PassengersTab from "../components/PassengerTab";
import AddTourTab from "../components/AddTourTab";
import AddPassengerTab from "../components/AddPassengerTab";
import PassengerRequests from "../components/PassengerRequests";
import BlackListTab from "../components/BlackList"; // Import the new BlackListTab
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
}

export default function ManagerInterface({
  tours,
  setTours,
  orders,
  setOrders,
  passengers: initialPassengers,
  setPassengers,
  currentUser,
}: ManagerInterfaceProps) {
  const [activeTab, setActiveTab] = useState<
    "tours" | "orders" | "addTour" | "passengers" | "addPassenger" | "passengerRequests" | "blacklist"
  >("tours");
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const { showNotification } = useNotifications();
  const {
    passengers,
    errors,
    isGroup,
    setIsGroup,
    groupName,
    setGroupName,
    addPassenger,
    updatePassenger,
    removePassenger,
    validateBooking,
  } = usePassengers(initialPassengers, setPassengers, currentUser, selectedTour, tours, showNotification);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Management Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage your tours, orders, and passengers efficiently</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                "tours",
                "orders",
                "passengers",
                "passengerRequests",
                "addTour",
                "addPassenger",
                "blacklist", // Added blacklist tab
              ].map((tab) => (
                <button
                  key={tab}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  onClick={() => setActiveTab(tab as "tours" | "orders" | "passengers" | "passengerRequests" | "addTour" | "addPassenger" | "blacklist")}
                >
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={
                          tab === "tours" || tab === "addTour"
                            ? "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"
                            : tab === "orders"
                              ? "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              : tab === "passengerRequests"
                                ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                : tab === "blacklist" // Icon for blacklist (e.g., a ban symbol)
                                  ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4.999c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                  : "M12 4v16m8-8H4"
                        }
                      />
                      {tab !== "tours" && tab !== "addTour" && tab !== "passengerRequests" && tab !== "blacklist" && (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab === "orders" ? "M9 5a2 2 0 012-2h2a2 2 0 012 2" : "M15 11a3 3 0 11-6 0 3 3 0 016 0z"} />
                      )}
                    </svg>
                    <span>
                      {tab === "addPassenger" ? "Add Passenger" : tab === "passengerRequests" ? "Passenger Requests" : tab === "blacklist" ? "Blacklist" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </span>
                    {tab !== "addTour" && tab !== "addPassenger" && (
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-semibold ml-2">
                        {tab === "tours" ? tours.length : tab === "orders" ? orders.length : tab === "passengers" ? passengers.length : tab === "blacklist" ? passengers.filter(p => p.is_blacklisted).length : 0}
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
        {activeTab === "passengerRequests" && (
          <PassengerRequests
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
        {activeTab === "blacklist" && (
          <BlackListTab
            passengers={passengers}
            setPassengers={setPassengers}
            currentUser={currentUser}
            showNotification={showNotification}
          />
        )}
      </div>
    </div>
  );
}