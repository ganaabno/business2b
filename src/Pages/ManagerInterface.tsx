import { useState, useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import type { User as UserType, Tour, Order, Passenger, ValidationError } from "../types/type";
import OrdersTab from "../components/OrdersTab";
import PassengersTab from "../components/PassengerTab";
import AddTourTab from "../components/AddTourTab";
import AddPassengerTab from "../components/AddPassengerTab";
import PassengerRequests from "../components/PassengerRequests";
import BlackListTab from "../components/BlackList";
import PassengersInLead from "../components/PassengersInLead";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../supabaseClient";

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
    "orders" | "passengers" | "addTour" | "addPassenger" | "passengerRequests" | "blacklist" | "pendingLeads"
  >("orders");

  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const { showNotification } = useNotifications();
  const [pendingLeadsCount, setPendingLeadsCount] = useState(0);

  // Fetch pending leads count for badge
  useEffect(() => {
    const fetchPendingLeadsCount = async () => {
      try {
        const { count, error } = await supabase
          .from("passengers_in_lead")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (error) {
          console.error("Error fetching pending leads count:", error);
          showNotification("error", `Failed to fetch pending leads count: ${error.message}`);
          return;
        }

        setPendingLeadsCount(count || 0);
      } catch (error) {
        console.error("Unexpected error fetching pending leads count:", error);
        showNotification("error", "An unexpected error occurred while fetching pending leads count.");
      }
    };

    fetchPendingLeadsCount();

    // Subscribe to real-time updates for pending leads count
    const subscription = supabase
      .channel("passengers_in_lead_count_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passengers_in_lead", filter: "status=eq.pending" },
        () => {
          fetchPendingLeadsCount(); // Refresh count on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [showNotification]);

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
                "pendingLeads",
              ].map((tab) => (
                <button
                  key={tab}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 ${
                    activeTab === tab
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
                        | "pendingLeads"
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
                              : tab === "pendingLeads"
                                ? "Pending Leads"
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
                              : tab === "pendingLeads"
                                ? pendingLeadsCount
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
        {activeTab === "pendingLeads" && (
          <PassengersInLead currentUser={currentUser} showNotification={showNotification} />
        )}
      </div>
    </div>
  );
}