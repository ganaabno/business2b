import { useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import type { User as UserType, Tour, Order, Passenger, ValidationError } from "../types/type";
import OrdersTab from "../components/OrdersTab";
import PassengersTab from "../components/PassengerTab";
import AddTourTab from "../components/AddTourTab";
import AddPassengerTab from "../components/AddPassengerTab";
import PassengerRequests from "../components/PassengerRequests";
import BlackListTab from "../components/BlackList";
import { useNotifications } from "../hooks/useNotifications";
import ToursTab from "../components/ToursTab";

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
  // Use lowercase "tours" for consistency
  const [activeTab, setActiveTab] = useState<
    "orders" | "passengers" | "addTour" | "addPassenger" | "passengerRequests" | "blacklist" | "tours"
  >("orders");

  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const { showNotification } = useNotifications();

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage your tours, orders, and passengers efficiently</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex justify-between">
              {[
                "orders",
                "passengers",
                "passengerRequests",
                "addTour",
                "addPassenger",
                "blacklist",
                "tours", // Added "tours" to the navigation
              ].map((tab) => (
                <button
                  key={tab}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  onClick={() =>
                    setActiveTab(
                      tab as
                      | "orders"
                      | "passengers"
                      | "passengerRequests"
                      | "addTour"
                      | "addPassenger"
                      | "blacklist"
                      | "tours"
                    )
                  }
                >
                  <div className="flex items-center space-x-2">
                    <span>
                      {tab === "addPassenger"
                        ? "Add Passenger"
                        : tab === "passengerRequests"
                          ? "Passenger Requests"
                          : tab === "addTour"
                            ? "Add Tour"
                            : tab === "blacklist"
                              ? "Blacklist"
                              : tab === "tours"
                                ? "Tours"
                                : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </span>
                    {tab !== "addTour" && tab !== "addPassenger" && (
                      <span className="bg-blue-100 text-blue-800 py-1 px-2 rounded-full text-xs font-semibold ml-2">
                        {tab === "orders"
                          ? orders.length
                          : tab === "passengers"
                            ? initialPassengers.length
                            : tab === "blacklist"
                              ? initialPassengers.filter((p) => p.is_blacklisted).length
                              : tab === "tours"
                                ? tours.length // Added count for tours
                                : 0}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === "orders" && <OrdersTab orders={orders} setOrders={setOrders} currentUser={currentUser} />}
        {activeTab === "passengers" && (
          <PassengersTab
            passengers={initialPassengers}
            setPassengers={setPassengers}
            currentUser={currentUser}
            showNotification={showNotification}
          />
        )}
        {activeTab === "passengerRequests" && <PassengerRequests showNotification={showNotification} />}
        {activeTab === "addTour" && (
          <AddTourTab tours={tours} setTours={setTours} currentUser={currentUser} showNotification={showNotification} />
        )}
        {activeTab === "addPassenger" && (
          <AddPassengerTab
            tours={tours}
            orders={orders}
            setOrders={setOrders}
            selectedTour={selectedTour}
            setSelectedTour={setSelectedTour}
            departureDate={departureDate}
            setDepartureDate={setDepartureDate}
            errors={errors}
            showNotification={showNotification}
            currentUser={currentUser}
            setErrors={setErrors}
          />
        )}
        {activeTab === "blacklist" && (
          <BlackListTab
            passengers={initialPassengers}
            setPassengers={setPassengers}
            currentUser={currentUser}
            showNotification={showNotification}
          />
        )}
        {activeTab === "tours" && <ToursTab tours={tours} setTours={setTours} />}
      </div>
    </div>
  );
}