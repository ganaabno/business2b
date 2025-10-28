import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import type {
  Passenger,
  ValidationError,
  Tour,
  OrderStatus,
} from "../types/type";
import { VALID_ORDER_STATUSES } from "../types/type";
import {
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PassengerWithUser extends Passenger {
  registeredBy: string;
  orderDepartureDate: string;
  orderTourTitle: string;
  createdBy?: string;
  orders: {
    id: string;
    tour_id: string;
    departureDate: string;
    createdBy: string;
    user_id: string;
    tours: Tour | null;
  } | null;
}

interface PassengerRequestsProps {
  showNotification: (type: "success" | "error", message: string) => void;
}

export default function PassengerRequests({
  showNotification,
}: PassengerRequestsProps) {
  const [passengers, setPassengers] = useState<PassengerWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    action: "approve" | "reject" | null;
    passengerId: string | null;
    message: string;
  } | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPassenger, setExpandedPassenger] = useState<string | null>(
    null
  );
  const itemsPerPage = 10;
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null
  );

  const formatDisplayDate = (s: string | undefined): string => {
    if (!s) return "Not provided";
    const d = new Date(s);
    return !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : s;
  };

  const getPassportExpiryColor = (expiryDate: string | null): string => {
    if (!expiryDate) return "text-gray-500";
    const expiry = new Date(expiryDate);
    const today = new Date();
    const monthsRemaining =
      (expiry.getFullYear() - today.getFullYear()) * 12 +
      (expiry.getMonth() - today.getMonth());
    if (monthsRemaining <= 0) return "text-red-600 bg-red-50 px-2 py-1 rounded";
    if (monthsRemaining <= 1) return "text-red-500 bg-red-50 px-2 py-1 rounded";
    if (monthsRemaining <= 3)
      return "text-orange-500 bg-orange-50 px-2 py-1 rounded";
    if (monthsRemaining <= 7)
      return "text-yellow-500 bg-yellow-50 px-2 py-1 rounded";
    return "text-green-600 bg-green-50 px-2 py-1 rounded";
  };

  const fetchPassengerRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const userId = userData?.user?.id || "unknown";
      let userRole = userData?.user?.role || "authenticated";

      console.log("fetchPassengerRequests: Starting fetch for user", {
        userId,
        userRole,
      });

      if (userError) {
        console.error("fetchPassengerRequests: Failed to get user", {
          userError,
        });
        showNotification("error", "Failed to authenticate user");
        setErrors([{ message: "Failed to authenticate user" }]);
        return;
      }

      if (userRole === "authenticated") {
        const { data: customUser, error: customUserError } = await supabase
          .from("users")
          .select("role")
          .eq("id", userId)
          .single();
        if (customUserError) {
          console.warn(
            "fetchPassengerRequests: Failed to fetch custom user role",
            {
              customUserError,
            }
          );
        } else if (customUser?.role) {
          userRole = customUser.role;
          console.log("fetchPassengerRequests: Using custom user role", {
            userRole,
          });
        }
      }

      if (!["manager", "admin", "superadmin"].includes(userRole)) {
        console.warn("fetchPassengerRequests: User is not authorized", {
          userRole,
        });
        showNotification(
          "error",
          "You are not authorized to view passenger requests"
        );
        setErrors([{ message: "Unauthorized access to passenger requests" }]);
        return;
      }

      const { data: rawData, error: rawError } = await supabase
        .from("passenger_requests")
        .select("*")
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false });

      if (rawError) {
        console.error("fetchPassengerRequests: Supabase error on raw fetch", {
          rawError,
        });
        showNotification(
          "error",
          `Failed to fetch passenger requests: ${rawError.message}`
        );
        setErrors([
          {
            message: `Failed to fetch passenger requests: ${rawError.message}`,
          },
        ]);
        return;
      }

      if (!rawData || rawData.length === 0) {
        console.log(
          "fetchPassengerRequests: No passenger requests found in table"
        );
        setPassengers([]);
      } else {
        console.log("fetchPassengerRequests: Raw passenger_requests data", {
          count: rawData.length,
          data: rawData,
        });
      }

      const { data, error } = await supabase
        .from("passenger_requests")
        .select(
          `
          *,
          orders (
            id,
            tour_id,
            departureDate,
            createdBy,
            user_id,
            tours (
              id,
              title,
              available_seats,
              departuredate,
              status,
              show_in_provider,
              description,
              creator_name,
              tour_number,
              name,
              dates,
              hotels,
              services,
              created_by,
              created_at,
              updated_at,
              base_price
            )
          ),
          users (
            id,
            email,
            username
          )
        `
        )
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetchPassengerRequests: Supabase error on full fetch", {
          error,
        });
        showNotification(
          "error",
          `Failed to fetch passenger requests with joins: ${error.message}`
        );
        setErrors([
          { message: `Failed to fetch passenger requests: ${error.message}` },
        ]);
        const passengerData = rawData.map((p: any) => ({
          ...p,
          registeredBy:
            p.users?.username || p.users?.email || p.user_id || "Unknown User",
          orderDepartureDate: p.departure_date || "",
          orderTourTitle: p.tour_title || "Unknown Tour",
          orders: null,
        })) as PassengerWithUser[];
        setPassengers(passengerData);
        console.log("fetchPassengerRequests: Fallback to raw data", {
          count: passengerData.length,
        });
        return;
      }

      if (!data || data.length === 0) {
        console.log(
          "fetchPassengerRequests: No passenger requests found with joins"
        );
        setPassengers([]);
      } else {
        console.log("fetchPassengerRequests: Raw data with joins", {
          count: data.length,
          data,
        });
      }

      const passengerData = data.map((p: any) => ({
        ...p,
        registeredBy:
          p.orders?.createdBy ||
          p.users?.username ||
          p.users?.email ||
          p.user_id ||
          "Unknown User",
        orderDepartureDate: p.orders?.departureDate || p.departure_date || "",
        orderTourTitle:
          p.orders?.tours?.title || p.tour_title || "Unknown Tour",
        orders: p.orders
          ? {
              id: p.orders.id,
              tour_id: p.orders.tour_id,
              departureDate: p.orders.departureDate,
              createdBy: p.orders.createdBy,
              user_id: p.orders.user_id,
              tours: p.orders.tours
                ? {
                    id: p.orders.tours.id,
                    title: p.orders.tours.title,
                    available_seats: p.orders.tours.available_seats ?? 0,
                    departuredate: p.orders.tours.departuredate || "",
                    status: p.orders.tours.status,
                    show_in_provider: p.orders.tours.show_in_provider,
                    description: p.orders.tours.description || "",
                    creator_name: p.orders.tours.creator_name || "",
                    tour_number: p.orders.tours.tour_number || "",
                    name: p.orders.tours.name || p.orders.tours.title,
                    dates: p.orders.tours.dates || [],
                    hotels: p.orders.tours.hotels || [],
                    services: p.orders.tours.services || [],
                    created_by: p.orders.tours.created_by || "",
                    created_at: p.orders.tours.created_at || "",
                    updated_at: p.orders.tours.updated_at || "",
                    base_price: p.orders.tours.base_price ?? 0,
                  }
                : null,
            }
          : null,
      })) as PassengerWithUser[];

      setPassengers(passengerData);
      setErrors([]);
      console.log("fetchPassengerRequests: Processed passenger requests", {
        count: passengerData.length,
      });
    } catch (error) {
      console.error("fetchPassengerRequests: Unexpected error", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      showNotification("error", "Unexpected error fetching passenger requests");
      setErrors([{ message: "Unexpected error fetching passenger requests" }]);
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    fetchPassengerRequests();

    console.log("Setting up real-time subscription for passenger_requests...");
    const channel = supabase.channel("passenger_requests_channel");
    subscriptionRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "passenger_requests",
          filter: "status=in.(pending,rejected)",
        },
        async (payload) => {
          console.log("Real-time passenger request update:", payload);
          await fetchPassengerRequests();
        }
      )
      .subscribe((status, error) => {
        console.log(
          "Passenger requests subscription status:",
          status,
          error ? `Error: ${error.message}` : ""
        );
        if (error) {
          showNotification("error", `Subscription error: ${error.message}`);
          setErrors([{ message: `Subscription error: ${error.message}` }]);
        }
      });

    return () => {
      console.log("Unsubscribing from passenger_requests_channel");
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [fetchPassengerRequests]);

  const updateOrderStatus = async (orderId: string, currentUserId: string) => {
    if (!orderId) {
      showNotification("error", "Invalid order ID");
      console.error("updateOrderStatus: Invalid order ID", { orderId });
      return;
    }

    // Check if order exists
    const { data: orderCheck, error: orderCheckError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();
    if (orderCheckError || !orderCheck) {
      console.error("updateOrderStatus: Order not found or error", {
        orderId,
        orderCheckError,
      });
      showNotification("error", `Order ${orderId} not found`);
      return;
    }
    console.log("updateOrderStatus: Order exists", { order: orderCheck });

    const { data: passengers, error: passengerError } = await supabase
      .from("passenger_requests")
      .select("status")
      .eq("order_id", orderId);
    if (passengerError) {
      console.error("updateOrderStatus: Failed to fetch passengers", {
        passengerError,
        orderId,
      });
      showNotification(
        "error",
        `Failed to fetch passengers: ${passengerError.message}`
      );
      return;
    }

    if (!passengers.length) {
      console.warn(
        "updateOrderStatus: No passengers found, setting status to pending",
        { orderId }
      );
      showNotification("error", "No passengers found for this order");
      return;
    }

    const statuses = passengers.map((p) => p.status);
    console.log("updateOrderStatus: Passenger statuses", { orderId, statuses });

    const newStatus: OrderStatus = statuses.every((s) => s === "active")
      ? "approved"
      : statuses.some((s) => s === "active")
      ? "partially_approved"
      : statuses.every((s) => s === "rejected")
      ? "rejected"
      : "pending";
    console.log("updateOrderStatus: Calculated newStatus", {
      orderId,
      newStatus,
    });

    if (!VALID_ORDER_STATUSES.includes(newStatus)) {
      console.error("updateOrderStatus: Invalid status value", {
        orderId,
        newStatus,
        validStatuses: VALID_ORDER_STATUSES,
      });
      showNotification(
        "error",
        `Invalid order status: ${newStatus}. Allowed statuses: ${VALID_ORDER_STATUSES.join(
          ", "
        )}`
      );
      return;
    }

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      edited_by: currentUserId,
    };
    console.log("updateOrderStatus: Attempting to update order", {
      orderId,
      updateData,
    });

    const { data, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select();
    if (updateError) {
      console.error("updateOrderStatus: Failed to update order", {
        updateError,
        details: updateError.details,
        code: updateError.code,
        message: updateError.message,
        updateData,
      });
      if (updateError.code === "23514") {
        showNotification(
          "error",
          `Invalid status "${newStatus}". Allowed statuses: ${VALID_ORDER_STATUSES.join(
            ", "
          )}`
        );
      } else {
        showNotification(
          "error",
          `Failed to update order status: ${updateError.message}`
        );
      }
      return;
    }

    console.log("updateOrderStatus: Order updated successfully", {
      orderId,
      newStatus,
      data,
    });
    showNotification("success", `Order ${orderId} updated to ${newStatus}`);
    return data;
  };

  const approvePassenger = async (passengerId: string) => {
    setLoading(true);
    try {
      // Get current user
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (userError || !currentUserId) {
        console.error("approvePassenger: Failed to get current user", {
          userError,
        });
        showNotification("error", "Failed to authenticate user");
        return;
      }

      const passenger = passengers.find((p) => p.id === passengerId);
      if (!passenger) {
        showNotification("error", "Passenger not found");
        console.log("approvePassenger: Passenger not found", { passengerId });
        return;
      }

      if (passenger.status === "rejected") {
        const tourId = passenger.orders?.tour_id || passenger.tour_id;
        if (tourId) {
          const { data: tourData, error: tourError } = await supabase
            .from("tours")
            .select("available_seats")
            .eq("id", tourId)
            .single();
          if (tourError) {
            console.error("approvePassenger: Failed to fetch tour", {
              tourError,
            });
            showNotification(
              "error",
              `Failed to fetch tour: ${tourError.message}`
            );
            return;
          }
          if (
            tourData.available_seats !== undefined &&
            tourData.available_seats <= 0
          ) {
            showNotification(
              "error",
              "Cannot approve passenger: No seats available"
            );
            console.log("approvePassenger: No seats available", {
              tourId,
              available_seats: tourData.available_seats,
            });
            return;
          }
        }
      }

      const cleanedPassenger: Passenger = {
        id: passenger.id,
        order_id: passenger.order_id,
        user_id: passenger.user_id,
        tour_id: passenger.tour_id,
        tour_title: passenger.tour_title,
        departure_date: passenger.departure_date,
        name: passenger.name,
        room_allocation: passenger.room_allocation,
        serial_no: passenger.serial_no,
        last_name: passenger.last_name,
        first_name: passenger.first_name,
        date_of_birth: passenger.date_of_birth,
        age: passenger.age,
        gender: passenger.gender,
        passport_number: passenger.passport_number,
        passport_expire: passenger.passport_expire,
        nationality: passenger.nationality,
        roomType: passenger.roomType,
        hotel: passenger.hotel,
        additional_services: passenger.additional_services,
        price: passenger.price,
        email: passenger.email,
        phone: passenger.phone,
        passport_upload: passenger.passport_upload,
        allergy: passenger.allergy,
        emergency_phone: passenger.emergency_phone,
        status: "active",
        is_blacklisted: passenger.is_blacklisted,
        blacklisted_date: passenger.blacklisted_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        notes: passenger.notes,
        seat_count: passenger.seat_count,
        ...(passenger.createdBy ? { createdBy: passenger.createdBy } : {}),
        main_passenger_id: passenger.main_passenger_id,
        sub_passenger_count: passenger.sub_passenger_count,
        has_sub_passengers: passenger.has_sub_passengers,
        passenger_number: "",
        booking_number: null,
        pax_type: "Adult",
      };

      console.log("approvePassenger: Attempting to insert into passengers", {
        passengerId,
        cleanedPassenger,
      });

      const { error: insertError } = await supabase
        .from("passengers")
        .insert(cleanedPassenger);
      if (insertError) {
        console.error("approvePassenger: Failed to insert into passengers", {
          insertError,
          message: insertError.message,
          details: insertError.details,
          code: insertError.code,
        });
        showNotification(
          "error",
          `Failed to approve passenger: ${insertError.message}`
        );
        return;
      }

      const { error: deleteError } = await supabase
        .from("passenger_requests")
        .delete()
        .eq("id", passengerId);
      if (deleteError) {
        console.error(
          "approvePassenger: Failed to delete from passenger_requests",
          {
            deleteError,
          }
        );
        showNotification(
          "error",
          `Failed to remove passenger from requests: ${deleteError.message}`
        );
        return;
      }

      if (passenger.status !== "active") {
        const tourId = passenger.orders?.tour_id || passenger.tour_id;
        if (tourId) {
          const { data: tourData, error: tourError } = await supabase
            .from("tours")
            .select("available_seats")
            .eq("id", tourId)
            .single();
          if (tourError) {
            console.error("approvePassenger: Failed to fetch tour", {
              tourError,
            });
            showNotification(
              "error",
              `Failed to fetch tour: ${tourError.message}`
            );
            return;
          }
          if (
            tourData.available_seats !== undefined &&
            tourData.available_seats > 0
          ) {
            const { error: updateError } = await supabase
              .from("tours")
              .update({
                available_seats: tourData.available_seats - 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", tourId);
            if (updateError) {
              console.error("approvePassenger: Failed to update tour seats", {
                updateError,
              });
              showNotification(
                "error",
                `Failed to update seats: ${updateError.message}`
              );
              return;
            }
            console.log("approvePassenger: Tour seats updated", {
              tourId,
              new_seats: tourData.available_seats - 1,
            });
          }
        }
      }

      await updateOrderStatus(
        String(passenger.orders?.id || passenger.order_id || ""),
        currentUserId
      );
      showNotification(
        "success",
        "Passenger approved and moved to passengers table"
      );
      console.log("approvePassenger: Success", { passengerId });
      await fetchPassengerRequests();
    } catch (error) {
      console.error("approvePassenger: Unexpected error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      showNotification("error", "Failed to approve passenger");
    } finally {
      setLoading(false);
    }
  };

  const rejectPassenger = async (passengerId: string) => {
    setLoading(true);
    try {
      // Get current user
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (userError || !currentUserId) {
        console.error("rejectPassenger: Failed to get current user", {
          userError,
        });
        showNotification("error", "Failed to authenticate user");
        return;
      }

      const passenger = passengers.find((p) => p.id === passengerId);
      if (!passenger) {
        showNotification("error", "Passenger not found");
        console.log("rejectPassenger: Passenger not found", { passengerId });
        return;
      }

      if (passenger.status === "active") {
        const tourId = passenger.orders?.tour_id || passenger.tour_id;
        if (tourId) {
          const { data: tourData, error: tourError } = await supabase
            .from("tours")
            .select("available_seats")
            .eq("id", tourId)
            .single();
          if (tourError) {
            console.error("rejectPassenger: Failed to fetch tour", {
              tourError,
            });
            showNotification(
              "error",
              `Failed to fetch tour: ${tourError.message}`
            );
            return;
          }
          if (tourData.available_seats !== undefined) {
            const { error: updateError } = await supabase
              .from("tours")
              .update({
                available_seats: tourData.available_seats + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", tourId);
            if (updateError) {
              console.error("rejectPassenger: Failed to update tour seats", {
                updateError,
              });
              showNotification(
                "error",
                `Failed to update seats: ${updateError.message}`
              );
              return;
            }
            console.log("rejectPassenger: Tour seats updated", {
              tourId,
              new_seats: tourData.available_seats + 1,
            });
          }
        }
      }

      const { error } = await supabase
        .from("passenger_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", passengerId);
      if (error) {
        console.error("rejectPassenger: Failed to update passenger_requests", {
          error,
          message: error.message,
          details: error.details,
          code: error.code,
        });
        showNotification(
          "error",
          `Failed to reject passenger: ${error.message}`
        );
        return;
      }

      await updateOrderStatus(
        String(passenger.orders?.id || passenger.order_id || ""),
        currentUserId
      );
      showNotification("success", "Passenger rejected successfully");
      console.log("rejectPassenger: Success", { passengerId });
      await fetchPassengerRequests();
    } catch (error) {
      console.error("rejectPassenger: Unexpected error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      showNotification("error", "Failed to reject passenger");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    if (!showConfirmModal?.passengerId) return;

    if (showConfirmModal.action === "approve") {
      approvePassenger(showConfirmModal.passengerId);
    } else if (showConfirmModal.action === "reject") {
      rejectPassenger(showConfirmModal.passengerId);
    }
    setShowConfirmModal(null);
  };

  const togglePassengerDetails = (passengerId: string) => {
    setExpandedPassenger(
      expandedPassenger === passengerId ? null : passengerId
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-8 h-8 text-slate-700" />
            <h1 className="text-3xl font-light text-slate-800">
              Passenger Requests
            </h1>
          </div>
          <p className="text-slate-500 text-sm ml-11">
            Manage and review passenger applications
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
              <p className="text-slate-600 text-sm">Loading passengers...</p>
            </div>
          </div>
        )}

        {/* Errors */}
        {!loading && errors.length > 0 && (
          <div className="mb-6 space-y-2">
            {errors.map((error, idx) => (
              <div
                key={idx}
                className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* No Requests State */}
        {!loading && passengers.length === 0 && errors.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">
              Currently no requests here...
            </h3>
            <p className="text-slate-500 text-sm">
              There are no pending or rejected passenger requests to review at
              the moment.
            </p>
          </div>
        )}

        {/* Passenger Cards */}
        {!loading && passengers.length > 0 && (
          <div className="space-y-3 mb-6">
            {passengers
              .slice(
                (currentPage - 1) * itemsPerPage,
                currentPage * itemsPerPage
              )
              .map((passenger) => (
                <div
                  key={passenger.id}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-medium text-slate-800">
                          {passenger.name}
                        </h3>
                        <button
                          onClick={() => togglePassengerDetails(passenger.id)}
                          className="text-slate-500 hover:text-slate-700"
                        >
                          {expandedPassenger === passenger.id ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>{passenger.orderTourTitle}</span>
                        <span className="text-slate-400">•</span>
                        <span>
                          {formatDisplayDate(passenger.orderDepartureDate)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">
                          Status:
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            passenger.status === "active"
                              ? "bg-green-100 text-green-700"
                              : passenger.status === "rejected"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {passenger.status}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setShowConfirmModal({
                              action: "approve",
                              passengerId: passenger.id,
                              message: `Approve passenger ${passenger.name}?`,
                            })
                          }
                          disabled={loading || passenger.status === "active"}
                          className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                          title="Approve"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() =>
                            setShowConfirmModal({
                              action: "reject",
                              passengerId: passenger.id,
                              message: `Reject passenger ${passenger.name}?`,
                            })
                          }
                          disabled={loading || passenger.status === "rejected"}
                          className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                          title="Reject"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Passenger Details */}
                  {expandedPassenger === passenger.id && (
                    <div className="mt-4 border-t border-slate-200 pt-4 space-y-4">
                      {/* Sub-Passenger Information */}
                      {!passenger.main_passenger_id && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Sub-Passengers
                          </h4>
                          <p className="text-sm text-gray-600">
                            Has Sub-Passengers:{" "}
                            {passenger.has_sub_passengers ? "Yes" : "No"}
                          </p>
                          {passenger.has_sub_passengers && (
                            <p className="text-sm text-gray-600">
                              Number of Sub-Passengers:{" "}
                              {passenger.sub_passenger_count || 0}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Personal Information */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Personal Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Serial No
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.serial_no || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              First Name
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.first_name || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Last Name
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.last_name || "Not provided"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Contact Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Email
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.email || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Phone
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.phone || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Emergency Phone
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.emergency_phone || "Not provided"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Demographics */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Personal
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Date of Birth
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDisplayDate(
                                passenger.date_of_birth ?? undefined
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Age
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.age != null
                                ? passenger.age
                                : "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Gender
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.gender || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Nationality
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.nationality || "Not provided"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Passport Information */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Passport Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Passport Number
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.passport_number || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Passport Expiry
                            </p>
                            <p
                              className={`text-sm ${getPassportExpiryColor(
                                passenger.passport_expire
                              )}`}
                            >
                              {formatDisplayDate(
                                passenger.passport_expire ?? undefined
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Passport Upload
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.passport_upload ? (
                                <a
                                  href={passenger.passport_upload}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  View Uploaded Passport
                                </a>
                              ) : (
                                "Not uploaded"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Accommodation Information */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Accommodation Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Room Type
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.roomType || "Not provided"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Room Allocation
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.room_allocation || "Auto-assigned"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Hotel
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.hotel || "Not provided"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Additional Information */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Additional Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Additional Services
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.additional_services?.length
                                ? passenger.additional_services.join(", ")
                                : "None"}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">
                              Allergies
                            </p>
                            <p className="text-sm text-gray-600">
                              {passenger.allergy || "None"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          Notes
                        </h4>
                        <p className="text-sm text-gray-600">
                          {passenger.notes || "No notes provided"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
              <h3 className="text-xl font-medium text-slate-800 mb-3">
                Confirm Action
              </h3>
              <p className="text-slate-600 mb-6">{showConfirmModal.message}</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowConfirmModal(null)}
                  className="px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors duration-200"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!loading && passengers.length > itemsPerPage && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Previous</span>
            </button>
            <span className="text-sm text-slate-600 font-medium">
              Page {currentPage}
            </span>
            <button
              disabled={passengers.length <= currentPage * itemsPerPage}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <span className="text-sm font-medium">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
