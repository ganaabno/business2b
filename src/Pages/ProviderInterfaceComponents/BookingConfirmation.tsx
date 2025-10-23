import { useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "../../supabaseClient";
import type { Order, User as UserType } from "../../types/type";

interface BookingConfirmationTabProps {
  orders: Order[];
  currentUser: UserType;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  formatDate: (dateString: string | null) => string;
}

interface BookingConfirmationInput {
  bus_number: string;
  guide_name: string;
  weather_emergency: string;
}

interface GroupedOrder {
  departureDate: string;
  travel_choice: string;
  passenger_count: number;
  orders: Order[];
  booking_confirmation?: Order["booking_confirmation"];
}

const BookingConfirmationTab: React.FC<BookingConfirmationTabProps> = ({
  orders,
  currentUser,
  setOrders,
  formatDate,
}) => {
  const [inputs, setInputs] = useState<{
    [groupKey: string]: BookingConfirmationInput;
  }>({});
  const [activeTab, setActiveTab] = useState<"pending" | "confirmed">(
    "pending"
  );
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Group orders by departure date and tour title
  const groupOrders = (orders: Order[]): GroupedOrder[] => {
    const grouped = orders.reduce((acc, order) => {
      const key = `${order.departureDate}_${order.travel_choice}`;
      if (!acc[key]) {
        acc[key] = {
          departureDate: order.departureDate,
          travel_choice: order.travel_choice || "N/A",
          passenger_count: 0,
          orders: [],
          booking_confirmation: order.booking_confirmation,
        };
      }
      // Ensure passenger_count is properly summed
      acc[key].passenger_count += Number(order.passenger_count) || 1;
      acc[key].orders.push(order);
      return acc;
    }, {} as { [key: string]: GroupedOrder });

    return Object.values(grouped);
  };

  const handleInputChange = (
    groupKey: string,
    field: keyof BookingConfirmationInput,
    value: string
  ) => {
    setInputs((prev) => ({
      ...prev,
      [groupKey]: {
        ...(prev[groupKey] ?? {
          bus_number: "",
          guide_name: "",
          weather_emergency: "",
        }),
        [field]: value,
      },
    }));
  };

  const handleConfirmBooking = async (
    groupKey: string,
    groupedOrder: GroupedOrder
  ) => {
    const input = inputs[groupKey];
    if (!input?.bus_number || !input?.guide_name) {
      toast.error("Bus Number and Guide Name are required!");
      return;
    }

    try {
      const orderIds = groupedOrder.orders.map((order) => order.id);
      const { error } = await supabase.from("booking_confirmations").upsert(
        orderIds.map((orderId) => ({
          order_id: orderId,
          bus_number: input.bus_number,
          guide_name: input.guide_name,
          weather_emergency: input.weather_emergency || null,
          updated_by: currentUser.id,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "order_id" }
      );

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? {
                ...order,
                booking_confirmation: {
                  order_id: order.id,
                  bus_number: input.bus_number,
                  guide_name: input.guide_name,
                  weather_emergency: input.weather_emergency || null,
                  updated_by: currentUser.id,
                  updated_at: new Date().toISOString(),
                },
              }
            : order
        )
      );
      toast.success("Booking confirmed successfully!");
    } catch (error) {
      console.error(
        "Error confirming booking:",
        JSON.stringify(error, null, 2)
      );
      toast.error("Failed to confirm booking.");
    }
  };

  const handleEditBooking = async (
    groupKey: string,
    groupedOrder: GroupedOrder
  ) => {
    const input = inputs[groupKey];
    if (!input?.bus_number || !input?.guide_name) {
      toast.error("Bus Number and Guide Name are required!");
      return;
    }

    try {
      const orderIds = groupedOrder.orders.map((order) => order.id);
      const { error } = await supabase
        .from("booking_confirmations")
        .update({
          bus_number: input.bus_number,
          guide_name: input.guide_name,
          weather_emergency: input.weather_emergency || null,
          updated_by: currentUser.id,
          updated_at: new Date().toISOString(),
        })
        .in("order_id", orderIds);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? {
                ...order,
                booking_confirmation: {
                  ...order.booking_confirmation!,
                  bus_number: input.bus_number,
                  guide_name: input.guide_name,
                  weather_emergency: input.weather_emergency || null,
                  updated_by: currentUser.id,
                  updated_at: new Date().toISOString(),
                },
              }
            : order
        )
      );
      setEditingOrderId(null);
      toast.success("Booking updated successfully!");
    } catch (error) {
      console.error("Error updating booking:", JSON.stringify(error, null, 2));
      toast.error("Failed to update booking.");
    }
  };

  const handleButtonClick = (groupKey: string, groupedOrder: GroupedOrder) => {
    if (editingOrderId === groupKey) {
      handleEditBooking(groupKey, groupedOrder);
    } else {
      setEditingOrderId(groupKey);
    }
  };

  const fields: {
    label: string;
    key: keyof BookingConfirmationInput;
    placeholder: string;
    required: boolean;
  }[] = [
    {
      label: "Bus Number",
      key: "bus_number",
      placeholder: "e.g. BUS-001",
      required: true,
    },
    {
      label: "Guide Name",
      key: "guide_name",
      placeholder: "e.g. John Smith",
      required: true,
    },
    {
      label: "Weather/Emergency",
      key: "weather_emergency",
      placeholder: "Optional notes",
      required: false,
    },
  ];

  const pendingOrders = groupOrders(
    orders.filter((order) => !order.booking_confirmation)
  );
  const confirmedOrders = groupOrders(
    orders.filter((order) => order.booking_confirmation)
  );

  return (
    <div className="my-10 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-semibold text-gray-900 mb-2 tracking-tight">
          Booking Confirmations
        </h2>
        <div className="h-1 w-[1200px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded mb-6"></div>

        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab("pending")}
            className={`
                relative px-6 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-300 ease-out
      ${
        activeTab === "pending"
          ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
          : "bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md hover:scale-102 shadow-sm"
      } active:scale-95`}
          >
            Pending Confirmation ({pendingOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("confirmed")}
            className={`
                relative px-6 py-2.5 rounded-xl font-medium text-sm
                transition-all duration-300 ease-out
      ${
        activeTab === "confirmed"
          ? "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105"
          : "bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md hover:scale-102 shadow-sm"
      } active:scale-95`}
          >
            Confirmed Bookings ({confirmedOrders.length})
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {(activeTab === "pending" ? pendingOrders : confirmedOrders)
            .length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-24 space-y-4">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center animate-pulse">
                <svg
                  className="w-10 h-10 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <p className="text-black text-md font-semibold">
                {activeTab === "pending"
                  ? "No orders available for confirmation"
                  : "No confirmed bookings available"}
              </p>
            </div>
          ) : (
            (activeTab === "pending" ? pendingOrders : confirmedOrders).map(
              (groupedOrder) => {
                const groupKey = `${groupedOrder.departureDate}_${groupedOrder.travel_choice}`;
                return (
                  <div
                    key={groupKey}
                    className="group bg-white rounded-3xl p-8 border border-gray-100 hover:border-indigo-200 hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="space-y-2">
                      <div className="border-b border-gray-50">
                        <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                          Tour Package
                        </p>
                        <p className="text-lg font-semibold text-gray-900">
                          {groupedOrder.travel_choice}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-gray-700">
                        <div>
                          <p className="text-xs mb-1">Departure</p>
                          <p className="text-sm font-medium">
                            {formatDate(groupedOrder.departureDate)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs mb-1">Passengers</p>
                          <p className="text-sm font-medium">
                            {groupedOrder.passenger_count}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        {fields.map(({ label, key, placeholder, required }) => (
                          <div key={key}>
                            <label className="block text-xs font-medium text-gray-500 mb-2">
                              {label}{" "}
                              {required && (
                                <span className="text-indigo-400">*</span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={
                                inputs[groupKey]?.[key] ??
                                groupedOrder.booking_confirmation?.[key] ??
                                ""
                              }
                              onChange={(e) =>
                                handleInputChange(groupKey, key, e.target.value)
                              }
                              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all outline-none text-sm shadow-sm hover:shadow-md"
                              placeholder={placeholder}
                              disabled={
                                activeTab === "confirmed" &&
                                editingOrderId !== groupKey
                              }
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-4">
                        <button
                          onClick={() =>
                            handleButtonClick(groupKey, groupedOrder)
                          }
                          className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white py-3.5 rounded-2xl font-semibold text-sm hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                          {groupedOrder.booking_confirmation &&
                          editingOrderId !== groupKey
                            ? "Edit"
                            : "Confirm Booking"}
                        </button>
                      </div>

                      <div className="pt-4">
                        <button
                          onClick={() =>
                            setExpandedGroup(
                              expandedGroup === groupKey ? null : groupKey
                            )
                          }
                          className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-semibold text-sm hover:bg-gray-200 focus:outline-none transition-all duration-300"
                        >
                          {expandedGroup === groupKey
                            ? "Hide Passenger Details"
                            : "Show Passenger Details"}
                        </button>
                        {expandedGroup === groupKey && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-2xl">
                            {groupedOrder.orders.map((passenger) => (
                              <div
                                key={passenger.id}
                                className="mb-2 last:mb-0"
                              >
                                <p className="text-sm font-medium text-gray-900">
                                  {passenger.last_name || "N/A"}{" "}
                                  {passenger.first_name || "N/A"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Email: {passenger.email || "N/A"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Room Allocation:{" "}
                                  {passenger.room_number || "N/A"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Hotel: {passenger.hotel || "N/A"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Passengers: {passenger.passenger_count}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmationTab;
