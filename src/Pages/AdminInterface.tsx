import { useState, useEffect, useCallback } from "react";
import {
  Users,
  MapPin,
  FileText,
  Edit,
  Save,
  Shield,
  Clock,
  DollarSign,
  Car,
  List,
  Calendar,
  CheckCircle,
  Plane,
  Hotel,
} from "lucide-react";
import type { User as UserType, Tour, Order } from "../types/type";
import { supabase } from "../supabaseClient";
import RoleChanger from "../components/RoleChanger";
import AuthRequest from "../components/AuthRequest";
import {
  fetchOrdersFromGlobalApi,
  fetchGlobalApiSnapshot,
  isGlobalApiEnabled,
  type GlobalApiSnapshot,
} from "../api/globalTravel";
import {
  pushGlobalTour,
  syncGlobalTours,
  type B2BGlobalTourSyncResult,
} from "../api/b2b";
import {
  listPendingUsersAdmin,
  listUsersAdmin,
  sendAdminTestEmail,
} from "../api/admin";
import { toast } from "react-toastify";
import AdminTasksTab from "../components/tasks/AdminTasksTab";
import PriceConfigTab from "../components/PriceConfigTab";
import CarTypesTab from "../components/Admin/CarTypesTab";
import ItineraryItemsTab from "../components/Admin/ItineraryItemsTab";
import SeasonalPricingTab from "../components/Admin/SeasonalPricingTab";
import TourDatesTab from "../components/Admin/TourDatesTab";
import TourItinerariesTab from "../components/Admin/TourItinerariesTab";
import TourFlightsTab from "../components/Admin/TourFlightsTab";
import TourHotelsTab from "../components/Admin/TourHotelsTab";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

interface AdminInterfaceProps {
  users: UserType[];
  setUsers: React.Dispatch<React.SetStateAction<UserType[]>>;
  tours: Tour[];
  setTours: React.Dispatch<React.SetStateAction<Tour[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  currentUser: UserType;
  onLogout: () => void;
}

function mapUserRoleForPersistence(value: unknown): {
  legacyRole: string;
  roleV2: "admin" | "manager" | "subcontractor" | "agent";
  workspaceRole:
    | "admin"
    | "superadmin"
    | "manager"
    | "provider"
    | "agent"
    | "subcontractor"
    | "user";
} {
  const role = String(value || "user")
    .trim()
    .toLowerCase();

  switch (role) {
    case "superadmin":
      return {
        legacyRole: "superadmin",
        roleV2: "admin",
        workspaceRole: "superadmin",
      };
    case "admin":
      return { legacyRole: "admin", roleV2: "admin", workspaceRole: "admin" };
    case "manager":
      return {
        legacyRole: "manager",
        roleV2: "manager",
        workspaceRole: "manager",
      };
    case "provider":
      return {
        legacyRole: "provider",
        roleV2: "agent",
        workspaceRole: "provider",
      };
    case "agent":
      return {
        legacyRole: "provider",
        roleV2: "agent",
        workspaceRole: "agent",
      };
    case "subcontractor":
      return {
        legacyRole: "user",
        roleV2: "subcontractor",
        workspaceRole: "subcontractor",
      };
    case "user":
      return {
        legacyRole: "user",
        roleV2: "subcontractor",
        workspaceRole: "user",
      };
    default:
      return {
        legacyRole: "user",
        roleV2: "subcontractor",
        workspaceRole: "user",
      };
  }
}

function AdminInterface({
  users,
  setUsers,
  tours,
  setTours,
  orders,
  setOrders,
  currentUser,
  onLogout,
}: AdminInterfaceProps) {
  const [selectedTab, setSelectedTab] = useState<
    | "authRequests"
    | "tasks"
    | "priceConfig"
    | "carTypes"
    | "itineraryItems"
    | "seasonalPricing"
    | "tourDates"
    | "tourItineraries"
    | "tourFlights"
    | "tourHotels"
  >("authRequests");

  // 🔥 ENHANCED: Better state management for pending count
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [newTour, setNewTour] = useState({
    title: "",
    description: "",
    departure_date: "",
    seats: "",
    hotels: "",
    services: "",
  });
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [adminTourSourceFilter, setAdminTourSourceFilter] = useState<
    "all" | "global" | "global+local" | "local"
  >("all");
  const [globalSnapshot, setGlobalSnapshot] =
    useState<GlobalApiSnapshot | null>(null);
  const [globalSnapshotLoading, setGlobalSnapshotLoading] = useState(false);
  const [globalSyncLoading, setGlobalSyncLoading] = useState(false);
  const [lastGlobalSyncResult, setLastGlobalSyncResult] =
    useState<B2BGlobalTourSyncResult | null>(null);
  const [globalPreviewOrders, setGlobalPreviewOrders] = useState<Order[]>([]);
  const [globalPreviewError, setGlobalPreviewError] = useState<string | null>(
    null,
  );
  const [testEmailRecipient, setTestEmailRecipient] = useState(
    String(currentUser.email || ""),
  );
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const refreshGlobalSnapshot = useCallback(async () => {
    if (!isGlobalApiEnabled) return;
    setGlobalSnapshotLoading(true);
    setGlobalPreviewError(null);
    try {
      const snapshot = await fetchGlobalApiSnapshot();
      let latestOrders: Order[] = [];

      try {
        const orders = await fetchOrdersFromGlobalApi();
        latestOrders = [...orders]
          .sort((a, b) => {
            const aTime = new Date(a.created_at || 0).getTime();
            const bTime = new Date(b.created_at || 0).getTime();
            return bTime - aTime;
          })
          .slice(0, 5);
      } catch (ordersError: any) {
        const message =
          ordersError?.message || "Global orders endpoint is unavailable";
        setGlobalPreviewError(message);
      }

      setGlobalSnapshot(snapshot);
      setGlobalPreviewOrders(latestOrders);
      if (!snapshot.online) {
        setGlobalPreviewError(snapshot.message);
      }
    } catch (error: any) {
      setGlobalPreviewOrders([]);
      setGlobalPreviewError(
        error?.message || "Failed to load Global API orders",
      );
    } finally {
      setGlobalSnapshotLoading(false);
    }
  }, []);

  const handleGlobalTourSync = useCallback(
    async (dryRun = false) => {
      setGlobalSyncLoading(true);
      try {
        const { data } = await syncGlobalTours({ dryRun });
        setLastGlobalSyncResult(data);

        const modeLabel = dryRun ? "Dry run" : "Sync";
        toast.success(
          `${modeLabel} done: ${data.inserted} inserted, ${data.updated} updated, ${data.linked} linked, ${data.skipped} skipped`,
        );

        if (!dryRun) {
          const { data: toursData } = await supabase
            .from("tours")
            .select("*")
            .order("created_at", { ascending: false });
          if (Array.isArray(toursData)) {
            setTours(toursData as Tour[]);
          }
        }

        void refreshGlobalSnapshot();
      } catch (error: any) {
        toast.error(error?.message || "Failed to sync Global tours");
      } finally {
        setGlobalSyncLoading(false);
      }
    },
    [refreshGlobalSnapshot, setTours],
  );

  // 🔥 ENHANCED: Refresh users when new auth requests are approved
  const handleAuthRequestRefresh = useCallback(async () => {
    try {
      const [usersRows, pendingRows] = await Promise.all([
        listUsersAdmin<UserType>().catch(async () => {
          const { data } = await supabase.from("users").select("*");
          return (data || []) as UserType[];
        }),
        listPendingUsersAdmin<{ id: string }>(),
      ]);
      setUsers(usersRows);
      setPendingUsersCount(pendingRows.length || 0);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      console.error(err);
    }
  }, [setUsers, setPendingUsersCount, setRefreshKey]);

  // 🔥 NEW: Auto-refresh pending count every 30 seconds
  useEffect(() => {
    void handleAuthRequestRefresh();
    const interval = setInterval(handleAuthRequestRefresh, 30000);
    return () => clearInterval(interval);
  }, [handleAuthRequestRefresh]);

  useEffect(() => {
    if (!isGlobalApiEnabled) {
      setGlobalSnapshot(null);
      return;
    }
  }, []);

  useEffect(() => {
    setTestEmailRecipient(String(currentUser.email || ""));
  }, [currentUser.email]);

  const handleSendTestEmail = useCallback(async () => {
    const recipient = testEmailRecipient.trim().toLowerCase();
    if (!recipient) {
      toast.error("Please enter recipient email");
      return;
    }

    setSendingTestEmail(true);
    try {
      const result = await sendAdminTestEmail(recipient);
      if (result?.queued) {
        toast.success(result.message || `Test email queued for ${recipient}`);
      } else {
        toast.warn(result?.message || "Test email was not queued");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to send test email");
    } finally {
      setSendingTestEmail(false);
    }
  }, [testEmailRecipient]);

  const handleAddTourTab = async () => {
    if (!newTour.departure_date) {
      toast.error("Departure date is required");
      return;
    }

    const tourData = {
      title: newTour.title.trim() || null,
      description: newTour.description.trim() || null,
      dates: newTour.departure_date ? [newTour.departure_date] : [],
      seats: newTour.seats ? parseInt(newTour.seats, 10) : null,
      hotels: newTour.hotels.trim()
        ? newTour.hotels
            .trim()
            .split(",")
            .map((h) => h.trim())
        : [],
      services: newTour.services.trim()
        ? newTour.services
            .trim()
            .split(",")
            .map((s) => ({ name: s.trim(), price: 0 }))
        : [],
      created_by: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("tours")
      .insert(tourData)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      toast.error("Error adding tour: " + error.message);
      return;
    }

    const insertedTour = {
      ...data,
      id: String(data.id),
      departure_date:
        (data as { departure_date?: string; departuredate?: string })
          .departure_date ||
        (data as { departuredate?: string }).departuredate ||
        newTour.departure_date,
    } as Tour;

    setTours([...tours, insertedTour]);

    let globalPushWarning: string | null = null;
    let pushedToGlobal = false;

    try {
      const pushResponse = await pushGlobalTour({
        action: "create",
        localTourId: insertedTour.id,
        remoteTourId: insertedTour.source_tour_id || undefined,
        tour: insertedTour as unknown as Record<string, unknown>,
      });

      pushedToGlobal =
        pushResponse.data.remoteAction === "created" ||
        pushResponse.data.remoteAction === "updated";
      globalPushWarning = pushResponse.data.warning || null;
    } catch (pushError) {
      globalPushWarning =
        pushError instanceof Error
          ? pushError.message
          : "Global push failed after local create.";
    }

    setNewTour({
      title: "",
      description: "",
      departure_date: "",
      seats: "",
      hotels: "",
      services: "",
    });

    toast.success(
      pushedToGlobal && !globalPushWarning
        ? "Tour added locally and pushed to Global"
        : "Tour added locally",
    );

    if (globalPushWarning) {
      toast.error(`Global sync warning: ${globalPushWarning}`);
    }
  };

  const handleDeleteTour = async (tourId: string) => {
    const deletingTour = tours.find((tour) => tour.id === tourId) || null;

    const { error } = await supabase.from("tours").delete().eq("id", tourId);
    if (error) {
      toast.error("Error deleting tour: " + error.message);
      return;
    }
    setTours(tours.filter((tour) => tour.id !== tourId));

    let globalPushWarning: string | null = null;
    let pushedToGlobal = false;

    try {
      const pushResponse = await pushGlobalTour({
        action: "delete",
        localTourId: tourId,
        remoteTourId: deletingTour?.source_tour_id || undefined,
      });

      pushedToGlobal = pushResponse.data.remoteAction === "deleted";
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
        : "Tour deleted locally",
    );

    if (globalPushWarning) {
      toast.error(`Global sync warning: ${globalPushWarning}`);
    }
  };

  const handleUpdateUser = async (user: UserType) => {
    const mappedRole = mapUserRoleForPersistence(user.role);
    const nowIso = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ...user,
      role: mappedRole.legacyRole,
      role_v2: mappedRole.roleV2,
      workspace_role: mappedRole.workspaceRole,
      updatedAt: nowIso,
      updated_at: nowIso,
    };

    let { error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", user.id);

    if (
      error &&
      String(error.message || "")
        .toLowerCase()
        .includes("workspace_role")
    ) {
      delete payload.workspace_role;
      const retry = await supabase
        .from("users")
        .update(payload)
        .eq("id", user.id);
      error = retry.error;
    }

    if (error) {
      toast.error("Error updating user: " + error.message);
      return;
    }
    setUsers(users.map((u) => (u.id === user.id ? user : u)));
    setEditingUser(null);
    toast.success("User updated successfully!");
  };

  // FIXED: Safe ID display function
  const displayOrderId = (id: any) => {
    if (!id) return "N/A";
    const idStr = String(id);
    if (idStr.length > 8) {
      return idStr.substring(0, 8) + "...";
    }
    return idStr;
  };

  const getTourSourceLabel = (sourceTag?: Tour["source_tag"]) => {
    if (sourceTag === "global") return "Global";
    if (sourceTag === "global+local") return "Global + Local";
    return "Local";
  };

  const getTourSourceClassName = (sourceTag?: Tour["source_tag"]) => {
    if (sourceTag === "global") {
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    }
    if (sourceTag === "global+local") {
      return "bg-blue-100 text-blue-700 border-blue-200";
    }
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  // DEBUG: Check if user can see admin tabs
  const canSeeAdminTabs =
    currentUser.role === "superadmin" || currentUser.role === "admin";

  const filteredAdminTours = tours.filter((tour) => {
    if (adminTourSourceFilter === "all") return true;
    return (tour.source_tag ?? "local") === adminTourSourceFilter;
  });

  // Tab configuration
  const tabs = [
    { key: "authRequests", label: "Auth Requests", icon: Clock },
    { key: "tasks", label: "Tasks", icon: CheckCircle },
    { key: "priceConfig", label: "Price Config", icon: DollarSign },
    { key: "carTypes", label: "Машин", icon: Car },
    { key: "itineraryItems", label: "Үйлчилгээ", icon: List },
    { key: "seasonalPricing", label: "Сезон", icon: Calendar },
    { key: "tourDates", label: "Аялын өдрүүд", icon: Calendar },
    { key: "tourItineraries", label: "Маршрут", icon: MapPin },
    { key: "tourFlights", label: "Нислэг", icon: Plane },
    { key: "tourHotels", label: "Зочид", icon: Hotel },
  ] as const;

  return (
    <div className="space-y-3">
      {/* RoleChanger Section */}
      <Card className="p-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gray-100 rounded-lg border border-gray-200">
              <Shield className="w-4 h-4 text-gray-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">User Management</h2>
              <p className="text-xs text-gray-500">
                Manage roles and permissions
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            currentUser.role === "superadmin"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-700"
          }`}>
            {currentUser.role} Access
          </span>
        </div>
        <RoleChanger
          users={users}
          setUsers={setUsers}
          currentUser={currentUser}
        />
      </Card>

      {/* Global API Status */}
      <Card className="p-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Global Travel API
            </p>
            <p className="text-sm text-gray-700">
              {isGlobalApiEnabled
                ? globalSnapshot?.message || "Checking connection..."
                : "Feature flag is OFF (VITE_GLOBAL_API_ENABLED=false)"}
            </p>
            <p className="text-xs text-gray-500">
              Last checked:{" "}
              {globalSnapshot?.checkedAt
                ? new Date(globalSnapshot.checkedAt).toLocaleString()
                : "-"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              isGlobalApiEnabled && globalSnapshot?.online
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}>
              {isGlobalApiEnabled
                ? globalSnapshot?.online
                  ? "Online"
                  : "Offline"
                : "Disabled"}
            </span>
            <span className="text-sm text-gray-600">
              Tours: {globalSnapshot?.toursCount ?? "—"}
            </span>
            <span className="text-sm text-gray-600">
              Orders: {globalSnapshot?.ordersCount ?? "—"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleGlobalTourSync(true)}
              disabled={globalSyncLoading}
            >
              {globalSyncLoading ? "Working..." : "Dry Run Sync"}
            </Button>
            <Button
              size="sm"
              onClick={() => void handleGlobalTourSync(false)}
              disabled={globalSyncLoading}
            >
              {globalSyncLoading ? "Working..." : "Sync Tours"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshGlobalSnapshot()}
              disabled={globalSnapshotLoading || !isGlobalApiEnabled}
            >
              {globalSnapshotLoading ? "Checking..." : "Refresh"}
            </Button>
          </div>
        </div>

        {lastGlobalSyncResult && (
          <p className="mt-3 text-xs text-gray-600">
            Last sync ({lastGlobalSyncResult.dryRun ? "dry run" : "applied"})
            at {new Date(lastGlobalSyncResult.processedAt).toLocaleString()}:
            inserted {lastGlobalSyncResult.inserted}, updated{" "}
            {lastGlobalSyncResult.updated}, linked{" "}
            {lastGlobalSyncResult.linked}, skipped{" "}
            {lastGlobalSyncResult.skipped}.
          </p>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
            Notification Test
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="email"
              value={testEmailRecipient}
              onChange={(event) => setTestEmailRecipient(event.target.value)}
              placeholder="recipient@example.com"
              className="w-full sm:max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <Button
              size="sm"
              onClick={() => void handleSendTestEmail()}
              disabled={sendingTestEmail}
            >
              {sendingTestEmail ? "Sending..." : "Send Test Email"}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Sends a test notification through backend outbox + Resend.
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
            Recent Global Orders (Latest 5)
          </p>

          {!isGlobalApiEnabled ? (
            <p className="text-sm text-amber-700">
              Turn on `VITE_GLOBAL_API_ENABLED=true` and restart dev server to
              load live global orders.
            </p>
          ) : globalPreviewError ? (
            <p className="text-sm text-red-600">{globalPreviewError}</p>
          ) : globalSnapshotLoading ? (
            <p className="text-sm text-gray-500">Loading latest orders...</p>
          ) : globalPreviewOrders.length === 0 ? (
            <p className="text-sm text-gray-500">
              No orders returned from Global API.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="py-2 pr-4 font-medium">Order</th>
                    <th className="py-2 pr-4 font-medium">Tour</th>
                    <th className="py-2 pr-4 font-medium">Departure</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {globalPreviewOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50">
                      <td className="py-2 pr-4 font-medium text-gray-800">
                        {displayOrderId(order.order_id || order.id)}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {order.tour || order.tour_title || "-"}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">
                        {order.departureDate || "-"}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                          {order.status || "pending"}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Tab Navigation */}
      <Card className="p-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={selectedTab === key ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedTab(key as typeof selectedTab)}
              className="text-xs"
            >
              <Icon className="w-3.5 h-3.5 mr-1" />
              {label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Tab Content */}
      {selectedTab === "authRequests" && canSeeAdminTabs && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-xl border border-gray-200">
                <Clock className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Account Approval Requests
                </h3>
                <p className="text-sm text-gray-500">
                  Review and approve new user registrations •{" "}
                  {pendingUsersCount} pending
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAuthRequestRefresh}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </Button>
          </div>

          <AuthRequest
            currentUserId={currentUser.id}
            onRefresh={handleAuthRequestRefresh}
            onPendingCountChange={(count) => {
              setPendingUsersCount(count);
            }}
            key={refreshKey}
          />
        </Card>
      )}

      {selectedTab === "tasks" && canSeeAdminTabs && (
        <AdminTasksTab currentUser={currentUser} />
      )}

      {selectedTab === "priceConfig" && canSeeAdminTabs && (
        <PriceConfigTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "carTypes" && canSeeAdminTabs && (
        <CarTypesTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "itineraryItems" && canSeeAdminTabs && (
        <ItineraryItemsTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "seasonalPricing" && canSeeAdminTabs && (
        <SeasonalPricingTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "tourDates" && canSeeAdminTabs && (
        <TourDatesTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "tourItineraries" && canSeeAdminTabs && (
        <TourItinerariesTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "tourFlights" && canSeeAdminTabs && (
        <TourFlightsTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}

      {selectedTab === "tourHotels" && canSeeAdminTabs && (
        <TourHotelsTab
          showNotification={(type, message) => toast[type](message)}
        />
      )}
    </div>
  );
}

export default AdminInterface;
