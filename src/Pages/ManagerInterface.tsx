import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import {
  Search,
  Upload,
  Download,
  Loader2,
  Plane,
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
  Calculator,
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
import ProviderAssignmentsTab from "../components/ProviderAssignmentsTab";
import ManagerStats from "../components/ManagerStats";
import ManagerTasksTab from "../components/tasks/ManagerTasksTab";
import DataTable from "../Parts/DataTable.";
import { useNotifications } from "../hooks/useNotifications";
import { supabase } from "../supabaseClient";
import { debounce } from "lodash";
import { useFlightDataStore } from "../Parts/flightDataStore";
import type { Tour, ValidationError } from "../types/type";
import ToursTable from "../components/ToursTable";
import ProviderInterface from "./ProviderInterface";
import B2BMonitoringPage from "./B2BMonitoringPage";
import { featureFlags } from "../config/featureFlags";
import { pushGlobalTour } from "../api/b2b";
import { ChatWidget } from "../components/Chat";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const supabaseClient = supabase;

type TabType =
  | "dashboard"
  | "tasks"
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
  | "contracts"
  | "providerAssignments"
  | "yourRequests"
  | "ProviderInterface"
  | "chatbot";

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
  { key: "tasks", labelKey: "tasks", icon: CheckCircle },
  {
    key: "yourRequests",
    labelKey: "yourRequests",
    icon: CheckCircle,
  },
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
    key: "contracts",
    labelKey: "contracts",
    icon: FileText,
  },
  {
    key: "providerAssignments",
    labelKey: "providerAssignments",
    icon: Users,
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
  {
    key: "chatbot",
    labelKey: "chatbot",
    icon: Calculator,
  },
];

const AgentContractsTab = React.lazy(
  () => import("../components/AgentContractsTab"),
);

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
  const normalizedLanguage = String(
    i18n.resolvedLanguage || i18n.language || "en",
  ).toLowerCase();
  const isMongolianLanguage = normalizedLanguage.startsWith("mn");
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
        leadId:
          params.get("leadId") ||
          `${params.get("tourId") || ""}-${params.get("date") || ""}-${params.get("name") || ""}`,
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
          leadId: `${tourId || ""}-${departureDate || ""}-${name || ""}`,
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
        leadId: `${tourId || ""}-${departureDate || ""}-${name || ""}`,
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
    i18n.changeLanguage(isMongolianLanguage ? "en" : "mn");
  };

  const showYourRequestsTab =
    featureFlags.b2bSeatRequestFlowEnabled ||
    featureFlags.b2bRoleV2Enabled ||
    featureFlags.b2bMonitoringEnabled;

  // Group tabs by category for better visual hierarchy
  const TAB_GROUPS = [
    {
      label: "Overview",
      keys: ["dashboard", "tasks"],
    },
    {
      label: "Operations",
      keys: ["yourRequests", "orders", "passengers", "addPassenger"],
    },
    {
      label: "Manage",
      keys: ["addTour", "tours", "contracts", "providerAssignments"],
    },
    {
      label: "Leads",
      keys: [
        "interestedLeads",
        "passengerRequests",
        "pendingLeads",
        "blacklist",
      ],
    },
    {
      label: "Tools",
      keys: ["flightData", "ProviderInterface", "chatbot"],
    },
  ];

  return (
    <>
      <Toaster position="top-right" />
      {/* Structured page layout */}
      <div className="flex flex-col min-h-0">
        {/* SINGLE STICKY BLOCK: title strip + tab nav — glues right under global Header */}
        <div
          className="sticky z-100000 top-0"
          style={{
            top: "57px", /* matches global Header height (py-3 + h-8 content ≈ 57px) */
            background: "var(--mono-surface)",
            borderBottom: "1.5px solid var(--mono-border)",
            boxShadow: "0 4px 12px rgba(29,78,216,0.08)",
          }}
        >
          {/* Mini title row */}
          <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: '1px solid var(--mono-border)' }}>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: "rgba(29,78,216,0.1)", color: "#1d4ed8" }}
              >
                Manager
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--mono-text)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
                {t("managerPanel")}
              </span>
              <span className="text-xs hidden sm:inline" style={{ color: "var(--mono-text-soft)" }}>
                · {currentUser?.email}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleLanguage}>
              {isMongolianLanguage ? "EN" : "MN"}
            </Button>
          </div>
          {/* Tab bar */}
          <div className="px-4 py-2 overflow-x-auto">
            <div className="flex items-center gap-4 min-w-max">
              {TAB_GROUPS.map((group) => {
                const groupTabs = TAB_CONFIG.filter(
                  ({ key }) =>
                    group.keys.includes(key) &&
                    (key !== "yourRequests" || showYourRequestsTab),
                );
                if (groupTabs.length === 0) return null;

                return (
                  <div key={group.label} className="flex items-center gap-1">
                    <span
                      className="text-[9px] font-bold uppercase tracking-widest mr-1.5 hidden sm:inline"
                      style={{ color: "var(--mono-text-soft)" }}
                    >
                      {group.label}
                    </span>
                    {groupTabs.map(
                      ({ key, labelKey, icon: Icon, countKey }) => {
                        const count = countKey
                          ? counts[countKey as keyof typeof counts]
                          : undefined;
                        const isActive = activeTab === key;

                        return (
                          <button
                            key={key}
                            onClick={() => setActiveTab(key as TabType)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap"
                            style={
                              isActive
                                ? {
                                    background:
                                      "linear-gradient(135deg, #1d4ed8, #1e3a8a)",
                                    color: "#fff",
                                    boxShadow: "0 2px 8px rgba(29,78,216,0.25)",
                                  }
                                : {
                                    background: "transparent",
                                    color: "var(--mono-text-muted)",
                                    border: "1px solid transparent",
                                  }
                            }
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                (
                                  e.currentTarget as HTMLElement
                                ).style.background = "var(--mono-surface)";
                                (
                                  e.currentTarget as HTMLElement
                                ).style.borderColor = "var(--mono-border)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                (
                                  e.currentTarget as HTMLElement
                                ).style.background = "transparent";
                                (
                                  e.currentTarget as HTMLElement
                                ).style.borderColor = "transparent";
                              }
                            }}
                          >
                            <Icon size={13} className="shrink-0" />
                            {t(labelKey)}
                            {count !== undefined && count > 0 && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4.5 text-center"
                                style={{
                                  background: isActive
                                    ? "rgba(255,255,255,0.25)"
                                    : "#ef4444",
                                  color: isActive ? "#fff" : "#fff",
                                }}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      },
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Dashboard welcome with hero structure */}
              <div
                className="rounded-xl p-6"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(29,78,216,0.06), var(--mono-surface))",
                  border: "1.5px solid var(--mono-border)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-widest mb-1"
                      style={{ color: "#1d4ed8" }}
                    >
                      Dashboard
                    </p>
                    <h1
                      className="text-2xl font-bold mb-1"
                      style={{
                        color: "var(--mono-text)",
                        fontFamily: "var(--font-display)",
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {t("welcomeManager", {
                        name: currentUser?.name || "Manager",
                      })}
                    </h1>
                    <p
                      className="text-sm"
                      style={{ color: "var(--mono-text-muted)" }}
                    >
                      Here's a summary of your team's activity
                    </p>
                  </div>
                  <div
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{
                      background: "rgba(20,184,166,0.1)",
                      color: "#0f766e",
                      border: "1px solid rgba(20,184,166,0.2)",
                    }}
                  >
                    Live data
                  </div>
                </div>
              </div>
              <ManagerStats currentUser={currentUser} />
            </div>
          )}

          {activeTab === "orders" && (
            <OrdersTab
              orders={orders}
              setOrders={setOrders}
              currentUser={currentUser}
            />
          )}

          {activeTab === "tasks" && (
            <ManagerTasksTab currentUser={currentUser} />
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
                const previousTour =
                  tours.find((tour: Tour) => tour.id === tourId) || null;
                const nowIso = new Date().toISOString();

                const updatePayload = {
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
                    .filter(Boolean)
                    .map((name) => ({ name, price: 0 })),
                  description: data.description,
                  show_to_user: data.show_to_user,
                  show_in_provider: data.show_in_provider,
                  updated_at: nowIso,
                };

                const { error } = await supabaseClient
                  .from("tours")
                  .update(updatePayload)
                  .eq("id", tourId);

                if (!error) {
                  let nextTour: Tour | null = null;
                  setTours((prev: Tour[]) =>
                    prev.map((t) =>
                      t.id === tourId
                        ? (() => {
                            const updatedTour = {
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
                                  .filter(Boolean)
                                  .map((name) => ({ name, price: 0 })) || [],
                              show_to_user: data.show_to_user,
                              show_in_provider: data.show_in_provider,
                              updated_at: nowIso,
                            };

                            nextTour = updatedTour as Tour;
                            return updatedTour;
                          })()
                        : t,
                    ),
                  );

                  let globalPushWarning: string | null = null;
                  let pushedToGlobal = false;

                  try {
                    const pushResponse = await pushGlobalTour({
                      action: "update",
                      localTourId: tourId,
                      remoteTourId: previousTour?.source_tour_id || undefined,
                      tour: {
                        ...(previousTour || {}),
                        ...(nextTour || {}),
                        id: tourId,
                      } as Record<string, unknown>,
                    });

                    pushedToGlobal =
                      pushResponse.data.remoteAction === "updated" ||
                      pushResponse.data.remoteAction === "created";
                    globalPushWarning = pushResponse.data.warning || null;
                  } catch (pushError) {
                    globalPushWarning =
                      pushError instanceof Error
                        ? pushError.message
                        : "Global push failed after local update.";
                  }

                  toast.success(
                    pushedToGlobal && !globalPushWarning
                      ? "Tour updated and synced to Global"
                      : "Tour updated successfully!",
                  );

                  if (globalPushWarning) {
                    toast.error(`Global sync warning: ${globalPushWarning}`);
                  }
                } else {
                  toast.error("Failed to update tour");
                  console.error(error);
                }
              }}
              onDelete={async (tourId) => {
                const deletingTour =
                  tours.find((tour: Tour) => tour.id === tourId) || null;

                const { error } = await supabaseClient
                  .from("tours")
                  .delete()
                  .eq("id", tourId);
                if (!error) {
                  setTours((prev: Tour[]) =>
                    prev.filter((t) => t.id !== tourId),
                  );

                  let globalPushWarning: string | null = null;
                  let pushedToGlobal = false;

                  try {
                    const pushResponse = await pushGlobalTour({
                      action: "delete",
                      localTourId: tourId,
                      remoteTourId: deletingTour?.source_tour_id || undefined,
                    });

                    pushedToGlobal =
                      pushResponse.data.remoteAction === "deleted";
                    globalPushWarning = pushResponse.data.warning || null;
                  } catch (pushError) {
                    globalPushWarning =
                      pushError instanceof Error
                        ? pushError.message
                        : "Global push failed after local delete.";
                  }

                  toast.success(
                    pushedToGlobal && !globalPushWarning
                      ? "Tour deleted locally and removed from Global"
                      : "Tour deleted",
                  );

                  if (globalPushWarning) {
                    toast.error(`Global sync warning: ${globalPushWarning}`);
                  }
                } else {
                  toast.error("Delete failed");
                }
              }}
              onStatusChange={async (id, status) => {
                const previousTour =
                  tours.find((tour: Tour) => tour.id === id) || null;

                const { error } = await supabaseClient
                  .from("tours")
                  .update({ status, updated_at: new Date().toISOString() })
                  .eq("id", id);

                if (!error) {
                  const nowIso = new Date().toISOString();
                  setTours((prev: Tour[]) =>
                    prev.map((t) =>
                      t.id === id ? { ...t, status, updated_at: nowIso } : t,
                    ),
                  );

                  let globalPushWarning: string | null = null;
                  let pushedToGlobal = false;

                  try {
                    const pushResponse = await pushGlobalTour({
                      action: "update",
                      localTourId: id,
                      remoteTourId: previousTour?.source_tour_id || undefined,
                      tour: {
                        ...(previousTour || {}),
                        status,
                        updated_at: nowIso,
                      } as Record<string, unknown>,
                    });

                    pushedToGlobal =
                      pushResponse.data.remoteAction === "updated" ||
                      pushResponse.data.remoteAction === "created";
                    globalPushWarning = pushResponse.data.warning || null;
                  } catch (pushError) {
                    globalPushWarning =
                      pushError instanceof Error
                        ? pushError.message
                        : "Global push failed after status update.";
                  }

                  toast.success(
                    pushedToGlobal && !globalPushWarning
                      ? `Tour is now ${status} and synced to Global`
                      : `Tour is now ${status}`,
                  );

                  if (globalPushWarning) {
                    toast.error(`Global sync warning: ${globalPushWarning}`);
                  }
                }
              }}
            />
          )}

          {activeTab === "contracts" && (
            <React.Suspense
              fallback={
                <div className="text-sm text-gray-500">
                  Loading contracts...
                </div>
              }
            >
              <AgentContractsTab
                currentUser={currentUser}
                showNotification={showNotification}
              />
            </React.Suspense>
          )}

          {activeTab === "providerAssignments" && (
            <ProviderAssignmentsTab
              tours={tours}
              currentUser={currentUser}
              showNotification={showNotification}
              onOpenProviderPreview={() => setActiveTab("ProviderInterface")}
            />
          )}

          <div className={activeTab === "addPassenger" ? "block" : "hidden"}>
            <AddPassengerTab
              tours={tours}
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
              onPrefilledLeadConsumed={() => setPrefilledLead(null)}
            />
          </div>

          {activeTab === "passengerRequests" && (
            <PassengerRequests showNotification={showNotification} />
          )}

          {activeTab === "yourRequests" && <B2BMonitoringPage />}

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
                  <Loader2 className="w-12 h-12 animate-spin text-gray-700 mx-auto mb-4" />
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
              readOnlyPreview
            />
          )}

          {activeTab === "chatbot" && (
            <div className="h-full min-h-[calc(100vh-12rem)]">
              <ChatWidget currentUser={currentUser} />
            </div>
          )}
        </div>{" "}
        {/* end main content p-6 */}
      </div>{" "}
      {/* end flex col wrapper */}
    </>
  );
}
