import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  Search,
  Upload,
  Download,
  RefreshCw,
  Loader2,
  Plane,
  Clock,
  FileSpreadsheet,
  Users,
  Calendar,
  DollarSign,
  MapPin,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageCircle,
  PhoneIncoming,
  UserPlus,
  LayoutDashboard,
  Ticket,
  Ban,
  FileText,
  PlaneTakeoff,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast, Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";

import OrdersTab from "../components/OrdersTab";
import PassengersTab from "../components/PassengerTab";
import AddTourTab from "../components/AddTourTab";
import AddPassengerTab from "../components/AddPassengerTab";
import PassengerRequests from "../components/PassengerRequests";
import BlackListTab from "../components/BlackList";
import PassengersInLead from "../components/PassengersInLead";
import InterestedLeadsTab from "../components/InterestedLeadsTab";
import DataTable from "../Parts/DataTable.";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../supabaseClient";
import { debounce } from "lodash";
import { useFlightDataStore } from "../Parts/flightDataStore";
import type { Tour, ValidationError } from "../types/type";
import ToursTable from "../components/ToursTable";
import ProviderInterface from "./ProviderInterface";

const supabaseClient = supabase;

type TabType =
  | "dashboard"
  | "orders"
  | "passengers"
  | "addTour"
  | "addPassenger"
  | "passengerRequests"
  | "interestedLeads"
  | "pendingLeads"
  | "blacklist"
  | "flightData"
  | "tours"
  | "ProviderInterface";

type TabConfig = {
  key: TabType;
  labelKey: string;
  icon: any;
  countKey?:
    | "orders"
    | "passengers"
    | "requests"
    | "interested"
    | "pendingLeads"
    | "blacklist"
    | "flightData"
    | "ProviderInterface";
};

const TAB_CONFIG: TabConfig[] = [
  { key: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { key: "orders", labelKey: "orders", icon: Ticket, countKey: "orders" },
  {
    key: "passengers",
    labelKey: "allPassengers",
    icon: Users,
    countKey: "passengers",
  },
  { key: "addPassenger", labelKey: "bookPassenger", icon: UserPlus },
  { key: "addTour", labelKey: "addTour", icon: PlaneTakeoff },
  {
    key: "tours",
    labelKey: "toursTable",
    icon: FileSpreadsheet,
  },
  {
    key: "interestedLeads",
    labelKey: "interestedLeads",
    icon: PhoneIncoming,
    countKey: "interested",
  },
  {
    key: "passengerRequests",
    labelKey: "passengerRequests",
    icon: MessageCircle,
    countKey: "requests",
  },
  {
    key: "pendingLeads",
    labelKey: "leadPassengers",
    icon: FileText,
    countKey: "pendingLeads",
  },
  {
    key: "blacklist",
    labelKey: "blacklist",
    icon: Ban,
    countKey: "blacklist",
  },
  {
    key: "flightData",
    labelKey: "flightData",
    icon: Plane,
    countKey: "flightData",
  },
  {
    key: "ProviderInterface",
    labelKey: "viewAsProvider",
    icon: LayoutDashboard,
    countKey: "flightData",
  },
];

export default function ManagerInterface({
  tours,
  setTours,
  orders,
  setOrders,
  passengers: initialPassengers,
  setPassengers,
  currentUser,
}: any) {
  const { i18n, t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [selectedTour, setSelectedTour] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);

  // In your main page or layout
  const [prefilledLead, setPrefilledLead] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fromLead") === "true") {
      setPrefilledLead({
        tourId: params.get("tourId"),
        departureDate: params.get("date"),
        name: params.get("name") || "",
        phone: params.get("phone") || "",
        passengerCount: parseInt(params.get("pax") || "1"),
      });
    }
  }, []);

  const { showNotification } = useNotifications();

  // Counts state
  const [counts, setCounts] = useState({
    orders: orders.length,
    passengers: initialPassengers.length,
    requests: 0,
    interested: 0,
    pendingLeads: 0,
    blacklist: initialPassengers.filter((p: any) => p.is_blacklisted).length,
    flightData: 0,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const {
    data: flightData,
    isLoading,
    fetchFlightData,
    subscribeToFlightData,
  } = useFlightDataStore();

  // Refresh counts
  const refreshCounts = useCallback(async () => {
    try {
      const [
        { count: reqCount },
        { count: interestedCount },
        { count: leadCount },
      ] = await Promise.all([
        supabaseClient
          .from("passenger_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabaseClient
          .from("interested_leads")
          .select("*", { count: "exact", head: true }),
        supabaseClient
          .from("passengers_in_lead")
          .select("*", { count: "exact", head: true }),
      ]);

      setCounts((prev) => ({
        ...prev,
        requests: reqCount || 0,
        interested: interestedCount || 0,
        pendingLeads: leadCount || 0,
      }));
    } catch (err) {
      console.error("Failed to fetch counts", err);
    }
  }, []);

  useEffect(() => {
    const handler = () => setActiveTab("addPassenger");
    window.addEventListener("prefill-success", handler);
    return () => window.removeEventListener("prefill-success", handler);
  }, []);

  useEffect(() => {
    const handleForcePrefill = (e: any) => {
      const { tourId, departureDate, name, phone, passengerCount } = e.detail;

      // SET EVERYTHING IN PARENT STATE
      setSelectedTour(tourId);
      setDepartureDate(departureDate);

      // Small delay to let React update
      setTimeout(() => {
        setPrefilledLead({
          name,
          phone,
          passengerCount,
          tourId,
          departureDate,
        });

        // Success → switch tab
        setActiveTab("addPassenger");
        window.dispatchEvent(new CustomEvent("prefill-success"));
      }, 100);
    };

    window.addEventListener("force-prefill-booking", handleForcePrefill);
    return () =>
      window.removeEventListener("force-prefill-booking", handleForcePrefill);
  }, []);

  useEffect(() => {
    const handleLeadRegistered = (e: any) => {
      const { name, phone, passengerCount, tourId, departureDate } = e.detail;

      // Set prefill
      setPrefilledLead({
        name,
        phone,
        passengerCount,
        tourId,
        departureDate,
      });

      // Switch to booking tab
      setActiveTab("addPassenger");

      toast.success(`Booking started for ${name} (${passengerCount} pax)`);
    };

    window.addEventListener("lead-registered", handleLeadRegistered);
    return () =>
      window.removeEventListener("lead-registered", handleLeadRegistered);
  }, []);

  useEffect(() => {
    refreshCounts();

    const channels = TAB_CONFIG.filter((t) => t.countKey)
      .map((tab) => {
        const tableMap: any = {
          requests: "passenger_requests",
          interested: "interested_leads",
          pendingLeads: "passengers_in_lead",
        };
        if (!tableMap[tab.countKey!]) return null;

        return supabaseClient
          .channel(`count_${tab.key}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: tableMap[tab.countKey!] },
            refreshCounts,
          )
          .subscribe();
      })
      .filter(Boolean);

    return () =>
      channels.forEach((ch) => ch && supabaseClient.removeChannel(ch));
  }, [refreshCounts]);

  useEffect(() => {
    if (activeTab !== "flightData") return;
    const loadFlightData = async () => {
      try {
        await fetchFlightData({ mode: "full" });
      } catch (err: any) {
        toast.error("Алдаа: " + err.message);
      }
    };

    void loadFlightData();
    const unsubscribe = subscribeToFlightData({ mode: "full" });
    return unsubscribe;
  }, [activeTab, fetchFlightData, subscribeToFlightData]);

  // Flight data stuff (unchanged)
  const filteredFlightData = useMemo(() => {
    if (!searchTerm) return flightData;
    const term = searchTerm.toLowerCase();
    return flightData.filter((row) =>
      Object.values(row).some(
        (val) => val && String(val).toLowerCase().includes(term),
      ),
    );
  }, [flightData, searchTerm]);

  const exportToCSV = () => {
    // your export logic
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "mn" ? "en" : "mn");
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="mono-shell flex">
        {/* SIDEBAR */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between gap-2">
              <h1 className="mono-title text-xl">{t("managerPanel")}</h1>
              <button
                onClick={toggleLanguage}
                className="mono-button mono-button--ghost mono-button--sm"
                title="Toggle language"
              >
                {i18n.language === "mn" ? "EN" : "MN"}
              </button>
            </div>
            <p className="text-sm text-gray-500 mt-1">{currentUser?.email}</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-4">
            {TAB_CONFIG.map(({ key, labelKey, icon: Icon, countKey }) => {
              const count = countKey
                ? counts[countKey as keyof typeof counts]
                : undefined;
              const isActive = activeTab === key;

              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as TabType)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 mx-3 rounded-lg text-left border transition-colors ${
                    isActive
                      ? "bg-gray-100 text-gray-900 border-gray-200 font-semibold"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{t(labelKey)}</span>
                  {count !== undefined && count > 0 && (
                    <span className="mono-badge mono-badge--danger">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-auto">
          <div
            className={`w-full py-8 ${
              activeTab === "orders" ||
              activeTab === "passengers" ||
              activeTab === "ProviderInterface"
                ? "px-0"
                : "px-4 sm:px-6 lg:px-8"
            }`}
          >
            {activeTab === "dashboard" && (
              <div className="text-center py-32">
                <h1 className="text-6xl font-bold text-gray-800 mb-4">
                   {t("welcomeManager", { name: currentUser?.name || "Manager" })}
                 </h1>
                 <p className="text-xl text-gray-600">
                   {t("selectTabFromSidebar")}
                 </p>
              </div>
            )}

            {activeTab === "orders" && (
              <OrdersTab
                orders={orders}
                setOrders={setOrders}
                currentUser={currentUser}
              />
            )}
            {activeTab === "passengers" && (
              <PassengersTab
                passengers={initialPassengers}
                setPassengers={setPassengers}
                currentUser={currentUser}
                showNotification={showNotification}
              />
            )}
            {activeTab === "addTour" && (
              <AddTourTab
                tours={tours}
                setTours={setTours}
                currentUser={currentUser}
                showNotification={showNotification}
              />
            )}
            {activeTab === "tours" && (
              <ToursTable
                tours={tours}
                onSave={async (tourId, data) => {
                  const { error } = await supabaseClient
                    .from("tours")
                    .update({
                      title: data.title,
                      departure_date: data.departure_date,
                      seats: parseInt(data.seats || "0"),
                      available_seats: parseInt(
                        data.available_seats || data.seats || "0",
                      ),
                      base_price: parseFloat(data.base_price || "0"),
                      status: data.status,
                      image_key: data.image_key,
                      hotels: data.hotels
                        ?.split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      services: data.services
                        ?.split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      description: data.description,
                      show_to_user: data.show_to_user,
                      show_in_provider: data.show_in_provider,
                    })
                    .eq("id", tourId);

                  if (!error) {
                    setTours((prev: Tour[]) =>
                      prev.map((t) =>
                        t.id === tourId
                          ? {
                              ...t,
                              ...data,
                              seats: parseInt(data.seats || "0"),
                              available_seats: parseInt(
                                data.available_seats || data.seats || "0",
                              ),
                              base_price: parseFloat(data.base_price || "0"),
                              hotels:
                                data.hotels
                                  ?.split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean) || [],
                              services:
                                data.services
                                  ?.split(",")
                                  .map((s) => s.trim())
                                  .filter(Boolean) || [],
                              show_to_user: data.show_to_user,
                              show_in_provider: data.show_in_provider,
                            }
                          : t,
                      ),
                    );
                    toast.success("Tour updated successfully!");
                  } else {
                    toast.error("Failed to update tour");
                    console.error(error);
                  }
                }}
                onDelete={async (tourId) => {
                  const { error } = await supabaseClient
                    .from("tours")
                    .delete()
                    .eq("id", tourId);
                  if (!error) {
                    setTours((prev: Tour[]) =>
                      prev.filter((t) => t.id !== tourId),
                    );
                    toast.success("Tour deleted");
                  } else {
                    toast.error("Delete failed");
                  }
                }}
                onStatusChange={async (id, status) => {
                  const { error } = await supabaseClient
                    .from("tours")
                    .update({ status })
                    .eq("id", id);

                  if (!error) {
                    setTours((prev: Tour[]) =>
                      prev.map((t) => (t.id === id ? { ...t, status } : t)),
                    );
                  }
                }}
              />
            )}

            {activeTab === "addPassenger" && (
              <AddPassengerTab
                orders={orders}
                setOrders={setOrders}
                selectedTour={selectedTour}
                setSelectedTour={setSelectedTour}
                departureDate={departureDate}
                setDepartureDate={setDepartureDate}
                errors={errors}
                setErrors={setErrors}
                showNotification={showNotification}
                currentUser={currentUser}
                prefilledLead={prefilledLead}
              />
            )}

            {activeTab === "passengerRequests" && (
              <PassengerRequests showNotification={showNotification} />
            )}

            {activeTab === "interestedLeads" && (
              <InterestedLeadsTab
                currentUser={currentUser}
                showNotification={showNotification}
              />
            )}

            {activeTab === "pendingLeads" && (
              <PassengersInLead
                currentUser={currentUser}
                showNotification={showNotification}
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

            {activeTab === "flightData" && (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-16">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-600 mx-auto mb-4" />
                    <p>{t("loadingFlightData")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="mono-title text-lg">{t("flightData")}</h3>
                      <button
                        onClick={exportToCSV}
                        className="mono-button mono-button--ghost flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> {t("exportToCSV")}
                      </button>
                    </div>
                    <DataTable data={filteredFlightData} />
                  </div>
                )}
              </div>
            )}

            {activeTab === "ProviderInterface" && (
              <ProviderInterface
                tours={tours}
                setTours={setTours}
                currentUser={currentUser}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
