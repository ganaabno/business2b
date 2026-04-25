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

interface PassengerRow {
  id: string;
  fullName: string;
  email: string;
  hotel: string;
  room: string;
  passengerCount: number;
}

const BookingConfirmationTab: React.FC<BookingConfirmationTabProps> = ({
  orders,
  currentUser,
  setOrders,
  formatDate,
}) => {
  const [inputs, setInputs] = useState<
    Record<string, BookingConfirmationInput>
  >({});
  const [activeTab, setActiveTab] = useState<"pending" | "confirmed">(
    "pending",
  );
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const getSafePassengerCount = (order: Order) => {
    if (
      typeof order.passenger_count === "number" &&
      order.passenger_count > 0
    ) {
      return order.passenger_count;
    }

    if (Array.isArray(order.passengers) && order.passengers.length > 0) {
      return order.passengers.length;
    }

    return 1;
  };

  const groupOrders = (orderList: Order[]): GroupedOrder[] => {
    const grouped = orderList.reduce(
      (acc, order) => {
        const departure = order.departureDate || "unknown-date";
        const travel = order.travel_choice || "N/A";
        const key = `${departure}_${travel}`;

        if (!acc[key]) {
          acc[key] = {
            departureDate: departure,
            travel_choice: travel,
            passenger_count: 0,
            orders: [],
            booking_confirmation: order.booking_confirmation,
          };
        }

        acc[key].passenger_count += getSafePassengerCount(order);
        acc[key].orders.push(order);

        if (!acc[key].booking_confirmation && order.booking_confirmation) {
          acc[key].booking_confirmation = order.booking_confirmation;
        }

        return acc;
      },
      {} as Record<string, GroupedOrder>,
    );

    return Object.values(grouped).sort((a, b) => {
      const aTime = new Date(a.departureDate).getTime();
      const bTime = new Date(b.departureDate).getTime();
      return aTime - bTime;
    });
  };

  const getPassengerRows = (groupedOrder: GroupedOrder): PassengerRow[] => {
    return groupedOrder.orders.flatMap((order) => {
      if (Array.isArray(order.passengers) && order.passengers.length > 0) {
        return order.passengers.map((passenger: any, index: number) => ({
          id: `${order.id}-${passenger?.id ?? index}`,
          fullName:
            [passenger?.last_name, passenger?.first_name]
              .filter(Boolean)
              .join(" ") ||
            [passenger?.lastname, passenger?.firstname]
              .filter(Boolean)
              .join(" ") ||
            passenger?.full_name ||
            passenger?.name ||
            [order.last_name, order.first_name].filter(Boolean).join(" ") ||
            "N/A",
          email: passenger?.email || order.email || "N/A",
          hotel: passenger?.hotel || order.hotel || "N/A",
          room:
            passenger?.room_number ||
            passenger?.room ||
            order.room_number ||
            "N/A",
          passengerCount: 1,
        }));
      }

      return [
        {
          id: order.id,
          fullName:
            [order.last_name, order.first_name].filter(Boolean).join(" ") ||
            "N/A",
          email: order.email || "N/A",
          hotel: order.hotel || "N/A",
          room: order.room_number || "N/A",
          passengerCount: getSafePassengerCount(order),
        },
      ];
    });
  };

  const handleInputChange = (
    groupKey: string,
    field: keyof BookingConfirmationInput,
    value: string,
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

  const handleExpandToggle = (groupKey: string, groupedOrder: GroupedOrder) => {
    const isOpening = expandedGroup !== groupKey;

    if (isOpening) {
      setInputs((prev) => ({
        ...prev,
        [groupKey]: {
          bus_number: groupedOrder.booking_confirmation?.bus_number ?? "",
          guide_name: groupedOrder.booking_confirmation?.guide_name ?? "",
          weather_emergency:
            groupedOrder.booking_confirmation?.weather_emergency ?? "",
        },
      }));
      setExpandedGroup(groupKey);
    } else {
      setExpandedGroup(null);
      if (editingGroupKey === groupKey) {
        setEditingGroupKey(null);
      }
    }
  };

  const handleConfirmBooking = async (
    groupKey: string,
    groupedOrder: GroupedOrder,
  ) => {
    const input = inputs[groupKey];

    if (!input?.bus_number.trim() || !input?.guide_name.trim()) {
      toast.error("Bus Number and Guide Name are required!");
      return;
    }

    try {
      const now = new Date().toISOString();
      const orderIds = groupedOrder.orders.map((o) => o.id);

      const { error } = await supabase.from("booking_confirmations").upsert(
        orderIds.map((orderId) => ({
          order_id: orderId,
          bus_number: input.bus_number.trim(),
          guide_name: input.guide_name.trim(),
          weather_emergency: input.weather_emergency.trim() || null,
          updated_by: currentUser.id,
          updated_at: now,
        })),
        { onConflict: "order_id" },
      );

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? {
                ...order,
                booking_confirmation: {
                  order_id: order.id,
                  bus_number: input.bus_number.trim(),
                  guide_name: input.guide_name.trim(),
                  weather_emergency: input.weather_emergency.trim() || null,
                  updated_by: currentUser.id,
                  updated_at: now,
                },
              }
            : order,
        ),
      );

      toast.success("Booking confirmed successfully!");
      setEditingGroupKey(null);
    } catch (error) {
      console.error("Error confirming booking:", error);
      toast.error("Failed to confirm booking.");
    }
  };

  const handleEditBooking = async (
    groupKey: string,
    groupedOrder: GroupedOrder,
  ) => {
    const input = inputs[groupKey];

    if (!input?.bus_number.trim() || !input?.guide_name.trim()) {
      toast.error("Bus Number and Guide Name are required!");
      return;
    }

    try {
      const now = new Date().toISOString();
      const orderIds = groupedOrder.orders.map((o) => o.id);

      const { error } = await supabase
        .from("booking_confirmations")
        .update({
          bus_number: input.bus_number.trim(),
          guide_name: input.guide_name.trim(),
          weather_emergency: input.weather_emergency.trim() || null,
          updated_by: currentUser.id,
          updated_at: now,
        })
        .in("order_id", orderIds);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? {
                ...order,
                booking_confirmation: {
                  order_id: order.id,
                  bus_number: input.bus_number.trim(),
                  guide_name: input.guide_name.trim(),
                  weather_emergency: input.weather_emergency.trim() || null,
                  updated_by: currentUser.id,
                  updated_at: now,
                },
              }
            : order,
        ),
      );

      setEditingGroupKey(null);
      toast.success("Booking updated successfully!");
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error("Failed to update booking.");
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
      label: "Weather / Emergency",
      key: "weather_emergency",
      placeholder: "Optional notes",
      required: false,
    },
  ];

  const pendingOrders = groupOrders(
    orders.filter((order) => !order.booking_confirmation),
  );

  const confirmedOrders = groupOrders(
    orders.filter((order) => order.booking_confirmation),
  );

  const currentOrders =
    activeTab === "pending" ? pendingOrders : confirmedOrders;

  return (
    <div className="mono-stack">
      <div className="mono-card p-5 sm:p-6">
        <h2 className="mono-title text-2xl">Booking Confirmations</h2>
        <p className="mono-subtitle text-sm mt-1">
          Confirm transport details per departure and travel package.
        </p>

        <div className="overflow-x-auto scrollbar-hide mt-4">
          <div className="mono-nav min-w-max">
            <button
              onClick={() => {
                setActiveTab("pending");
                setExpandedGroup(null);
                setEditingGroupKey(null);
              }}
              className={`mono-nav-item ${
                activeTab === "pending" ? "mono-nav-item--active" : ""
              }`}
            >
              Pending ({pendingOrders.length})
            </button>

            <button
              onClick={() => {
                setActiveTab("confirmed");
                setExpandedGroup(null);
                setEditingGroupKey(null);
              }}
              className={`mono-nav-item ${
                activeTab === "confirmed" ? "mono-nav-item--active" : ""
              }`}
            >
              Confirmed ({confirmedOrders.length})
            </button>
          </div>
        </div>
      </div>

      <div className="mono-card p-0 overflow-hidden">
        {currentOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {activeTab === "pending"
              ? "No orders available for confirmation"
              : "No confirmed bookings available"}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {currentOrders.map((groupedOrder) => {
              const groupKey = `${groupedOrder.departureDate}_${groupedOrder.travel_choice}`;
              const confirmation = groupedOrder.booking_confirmation;
              const isExpanded = expandedGroup === groupKey;
              const isEditing = editingGroupKey === groupKey;
              const isConfirmed = Boolean(confirmation);
              const passengerRows = getPassengerRows(groupedOrder);

              return (
                <div key={groupKey} className="bg-white">
                  <button
                    type="button"
                    onClick={() => handleExpandToggle(groupKey, groupedOrder)}
                    className="w-full text-left px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                      <div className="lg:col-span-4 min-w-0">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                          Tour Package
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                          {groupedOrder.travel_choice}
                        </p>
                      </div>

                      <div className="lg:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                          Departure
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {formatDate(groupedOrder.departureDate)}
                        </p>
                      </div>

                      <div className="lg:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                          Passengers
                        </p>
                        <p className="text-sm font-medium text-gray-800">
                          {groupedOrder.passenger_count}
                        </p>
                      </div>

                      <div className="lg:col-span-2">
                        <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                          Status
                        </p>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isConfirmed
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {isConfirmed ? "Confirmed" : "Pending"}
                        </span>
                      </div>

                      <div className="lg:col-span-2 flex justify-start lg:justify-end">
                        <span className="text-sm font-medium text-gray-500">
                          {isExpanded ? "Hide Details" : "View Details"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-200 px-4 sm:px-5 py-5 bg-gray-50">
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                        <div className="xl:col-span-4">
                          <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3 mb-4">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-900">
                                  Booking Confirmation
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                  Fill in transport and guide details.
                                </p>
                              </div>

                              {isConfirmed && !isEditing && (
                                <button
                                  type="button"
                                  onClick={() => setEditingGroupKey(groupKey)}
                                  className="mono-button mono-button--ghost"
                                >
                                  Edit
                                </button>
                              )}
                            </div>

                            <div className="space-y-4">
                              {fields.map(
                                ({ label, key, placeholder, required }) => (
                                  <div key={key}>
                                    <label className="block text-xs font-medium text-gray-500 mb-2">
                                      {label}{" "}
                                      {required ? (
                                        <span className="text-gray-400">*</span>
                                      ) : null}
                                    </label>
                                    <input
                                      type="text"
                                      value={inputs[groupKey]?.[key] ?? ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          groupKey,
                                          key,
                                          e.target.value,
                                        )
                                      }
                                      disabled={isConfirmed && !isEditing}
                                      placeholder={placeholder}
                                      className="mono-input"
                                    />
                                  </div>
                                ),
                              )}
                            </div>

                            <div className="mt-4 flex flex-col sm:flex-row gap-3">
                              {!isConfirmed && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleConfirmBooking(groupKey, groupedOrder)
                                  }
                                  className="mono-button w-full"
                                >
                                  Confirm Booking
                                </button>
                              )}

                              {isConfirmed && isEditing && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEditBooking(groupKey, groupedOrder)
                                    }
                                    className="mono-button w-full"
                                  >
                                    Save Changes
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingGroupKey(null);
                                      setInputs((prev) => ({
                                        ...prev,
                                        [groupKey]: {
                                          bus_number:
                                            confirmation?.bus_number ?? "",
                                          guide_name:
                                            confirmation?.guide_name ?? "",
                                          weather_emergency:
                                            confirmation?.weather_emergency ??
                                            "",
                                        },
                                      }));
                                    }}
                                    className="mono-button mono-button--ghost w-full"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="xl:col-span-8">
                          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                            <div className="px-4 py-4 border-b border-gray-200">
                              <h3 className="text-sm font-semibold text-gray-900">
                                Passenger Details
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">
                                All passengers under this departure and package.
                              </p>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr className="text-left">
                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                      #
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                      Full Name
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                      Email
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                      Hotel
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                      Room
                                    </th>
                                    <th className="px-4 py-3 font-semibold text-gray-600">
                                      Passenger Count
                                    </th>
                                  </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                  {passengerRows.length === 0 ? (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-4 py-6 text-center text-gray-500"
                                      >
                                        No passenger details found.
                                      </td>
                                    </tr>
                                  ) : (
                                    passengerRows.map((row, index) => (
                                      <tr
                                        key={row.id}
                                        className="hover:bg-gray-50"
                                      >
                                        <td className="px-4 py-3 text-gray-500">
                                          {index + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                                          {row.fullName}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                          {row.email}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                          {row.hotel}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                          {row.room}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                          {row.passengerCount}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingConfirmationTab;
