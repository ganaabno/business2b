import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Database,
  Download,
  Filter,
  Globe2,
  RefreshCw,
  Search,
  Upload,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  fetchGlobalApiSnapshot,
  fetchOrdersFromGlobalApi,
  fetchToursFromGlobalApi,
  isGlobalApiEnabled,
  type GlobalApiSnapshot,
} from "../api/globalTravel";
import {
  syncGlobalTours,
  type B2BGlobalTourSyncResult,
} from "../api/b2b";
import type { Order, Tour } from "../types/type";
import { extractTourDepartureDates } from "../utils/tourDates";

const TOUR_PREVIEW_LIMIT = 24;
const ORDER_PREVIEW_LIMIT = 20;

type SortBy = "title" | "departure" | "price" | "seats";
type SourceFilter = "all" | "global" | "global+local" | "local";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const raw = error.message.trim();
    if (
      /b2b api is unreachable|failed to fetch|econnrefused|networkerror/i.test(
        raw,
      )
    ) {
      return "B2B API is offline. Run `npm run api:dev` in a separate terminal, then retry sync.";
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatDate(value: string | undefined | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function formatPrice(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "TBD";
  return `MNT ${numeric.toLocaleString()}`;
}

function normalizeHotels(hotels: Tour["hotels"]): string[] {
  if (Array.isArray(hotels)) {
    return hotels
      .map((hotel) => String(hotel || "").trim())
      .filter((hotel) => hotel.length > 0);
  }

  if (typeof hotels === "string") {
    return hotels
      .split(",")
      .map((hotel) => hotel.trim())
      .filter((hotel) => hotel.length > 0);
  }

  return [];
}

function sourceLabel(sourceTag?: Tour["source_tag"]) {
  if (sourceTag === "global") return "Global";
  if (sourceTag === "global+local") return "Global + Local";
  return "Local";
}

function sourceBadgeClass(sourceTag?: Tour["source_tag"]) {
  if (sourceTag === "global") {
    return "bg-emerald-500/95 text-white";
  }

  if (sourceTag === "global+local") {
    return "bg-sky-500/95 text-white";
  }

  return "bg-slate-700/90 text-white";
}

function orderStatusClass(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("confirm") || normalized.includes("paid")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized.includes("pending") || normalized.includes("processing")) {
    return "bg-amber-100 text-amber-700";
  }
  if (normalized.includes("reject") || normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-700";
  }
  return "bg-slate-100 text-slate-700";
}

function getPrimaryDepartureDate(tour: Tour) {
  const dates = extractTourDepartureDates(tour);
  return dates[0] || "";
}

function getTourDepartureCount(tour: Tour) {
  return extractTourDepartureDates(tour).length;
}

function getTourSeatCount(tour: Tour) {
  const remaining = Number(tour.available_seats);
  if (Number.isFinite(remaining) && remaining >= 0) {
    return remaining;
  }
  return Number(tour.seats || 0);
}

export default function GlobalTravelInterface() {
  const [sourceSystem, setSourceSystem] = useState("global-travel");
  const [snapshot, setSnapshot] = useState<GlobalApiSnapshot | null>(null);
  const [tours, setTours] = useState<Tour[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastSyncResult, setLastSyncResult] =
    useState<B2BGlobalTourSyncResult | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("departure");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [toursLoading, setToursLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const buttonBase =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    setErrorMessage("");
    try {
      const next = await fetchGlobalApiSnapshot();
      setSnapshot(next);
      if (next.online) {
        toast.success("Global API reachable");
      } else {
        toast.error(next.message || "Global API appears offline");
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to check Global API");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSnapshotLoading(false);
    }
  }, []);

  const loadTours = useCallback(async (silent = false) => {
    setToursLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchToursFromGlobalApi();
      setTours(rows);
      if (!silent) {
        toast.success(`Fetched ${rows.length} tours from Global Travel`);
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to fetch Global tours");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setToursLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setErrorMessage("");
    try {
      const rows = await fetchOrdersFromGlobalApi();
      setOrders(rows);
      toast.success(`Fetched ${rows.length} orders from Global Travel`);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Failed to fetch Global orders");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const runSync = useCallback(
    async (dryRun: boolean) => {
      setSyncLoading(true);
      setErrorMessage("");
      try {
        const { data } = await syncGlobalTours({
          dryRun,
          sourceSystem: sourceSystem.trim() || undefined,
        });

        setLastSyncResult(data);
        toast.success(
          `${dryRun ? "Dry run" : "Sync"}: ${data.inserted} inserted, ${data.updated} updated, ${data.linked} linked`,
        );
      } catch (error: unknown) {
        const message = getErrorMessage(error, "Failed to sync Global tours");
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setSyncLoading(false);
      }
    },
    [sourceSystem],
  );

  const runAllChecks = useCallback(async () => {
    await loadSnapshot();
    await Promise.all([loadTours(), loadOrders()]);
  }, [loadSnapshot, loadTours, loadOrders]);

  useEffect(() => {
    if (!isGlobalApiEnabled) {
      setSnapshot(null);
      setTours([]);
      setOrders([]);
      return;
    }
  }, []);

  const sourceCounts = useMemo(() => {
    return tours.reduce(
      (acc, tour) => {
        const key = (tour.source_tag || "local") as Exclude<SourceFilter, "all">;
        acc[key] += 1;
        return acc;
      },
      {
        global: 0,
        "global+local": 0,
        local: 0,
      },
    );
  }, [tours]);

  const filteredTours = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return tours.filter((tour) => {
      const tourSource = (tour.source_tag || "local") as Exclude<SourceFilter, "all">;
      const hotels = normalizeHotels(tour.hotels).join(" ").toLowerCase();
      const haystack = `${tour.title} ${tour.name || ""} ${tour.description || ""} ${hotels}`.toLowerCase();

      const sourceMatches = sourceFilter === "all" || tourSource === sourceFilter;
      const searchMatches = !normalizedSearch || haystack.includes(normalizedSearch);

      return sourceMatches && searchMatches;
    });
  }, [tours, sourceFilter, searchTerm]);

  const sortedTours = useMemo(() => {
    const rows = [...filteredTours];

    rows.sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortBy === "price") {
        return Number(b.base_price || 0) - Number(a.base_price || 0);
      }

      if (sortBy === "seats") {
        return getTourSeatCount(b) - getTourSeatCount(a);
      }

      const aDate = getPrimaryDepartureDate(a);
      const bDate = getPrimaryDepartureDate(b);
      const aTime = aDate ? new Date(aDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = bDate ? new Date(bDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    return rows.slice(0, TOUR_PREVIEW_LIMIT);
  }, [filteredTours, sortBy]);

  const ordersPreview = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, ORDER_PREVIEW_LIMIT);
  }, [orders]);

  const rawPreview = useMemo(
    () =>
      JSON.stringify(
        {
          snapshot,
          sync: lastSyncResult,
          toursSample: tours.slice(0, 2),
          ordersSample: orders.slice(0, 2),
        },
        null,
        2,
      ),
    [snapshot, lastSyncResult, tours, orders],
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mono-container px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-900 via-blue-800 to-cyan-700 text-white p-6 sm:p-8">
          <div className="absolute -top-20 -right-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-60 w-60 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full bg-white/15 border border-white/20">
              <Globe2 className="h-4 w-4" />
              GLOBAL-TRAVEL LIVE SANDBOX
            </span>

            <h2 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight">
              Global Travel Interface
            </h2>
            <p className="mt-2 text-sm sm:text-base text-sky-100 max-w-3xl">
              Same workflow style as the Global-Travel side: fetch live tours,
              inspect card-level data, verify orders, then sync into B2B from one
              place.
            </p>

            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3">
                <p className="text-xs text-sky-100">API Status</p>
                <p className="mt-1 text-lg font-semibold inline-flex items-center gap-2">
                  {snapshot?.online ? (
                    <>
                      <Wifi className="h-4 w-4" />
                      Online
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4" />
                      Offline
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3">
                <p className="text-xs text-sky-100">Tours Fetched</p>
                <p className="mt-1 text-lg font-semibold">{tours.length}</p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3">
                <p className="text-xs text-sky-100">Orders Fetched</p>
                <p className="mt-1 text-lg font-semibold">{orders.length}</p>
              </div>

              <div className="rounded-2xl bg-white/12 border border-white/20 px-4 py-3">
                <p className="text-xs text-sky-100">Last Sync</p>
                <p className="mt-1 text-sm font-semibold">
                  {lastSyncResult
                    ? formatDate(lastSyncResult.processedAt)
                    : "Not run yet"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-base font-semibold text-slate-900">Live Fetch</h3>
              <p className="text-xs text-slate-500">
                Global API flag: {isGlobalApiEnabled ? "enabled" : "disabled"}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                className={`${buttonBase} bg-slate-100 text-slate-700 hover:bg-slate-200`}
                onClick={() => {
                  void loadSnapshot();
                }}
                disabled={snapshotLoading}
              >
                <RefreshCw className={`h-4 w-4 ${snapshotLoading ? "animate-spin" : ""}`} />
                {snapshotLoading ? "Checking..." : "Check"}
              </button>

              <button
                className={`${buttonBase} bg-sky-100 text-sky-700 hover:bg-sky-200`}
                onClick={() => {
                  void loadTours();
                }}
                disabled={toursLoading}
              >
                <Download className="h-4 w-4" />
                {toursLoading ? "Fetching..." : "Fetch Tours"}
              </button>

              <button
                className={`${buttonBase} bg-indigo-100 text-indigo-700 hover:bg-indigo-200`}
                onClick={() => {
                  void loadOrders();
                }}
                disabled={ordersLoading}
              >
                <Download className="h-4 w-4" />
                {ordersLoading ? "Fetching..." : "Fetch Orders"}
              </button>

              <button
                className={`${buttonBase} bg-emerald-100 text-emerald-700 hover:bg-emerald-200`}
                onClick={() => {
                  void runAllChecks();
                }}
                disabled={snapshotLoading || toursLoading || ordersLoading}
              >
                <Database className="h-4 w-4" />
                Run All
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Snapshot says: {snapshot?.message || "No health check yet"}
            </p>
          </div>

          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Sync to B2B</h3>

            <label className="block mt-3 text-xs font-semibold text-slate-600">
              Source System
            </label>
            <input
              value={sourceSystem}
              onChange={(event) => setSourceSystem(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400/50"
              placeholder="global-travel"
            />

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                className={`${buttonBase} bg-amber-100 text-amber-700 hover:bg-amber-200`}
                onClick={() => {
                  void runSync(true);
                }}
                disabled={syncLoading}
              >
                <Upload className="h-4 w-4" />
                {syncLoading ? "Working..." : "Dry Run"}
              </button>
              <button
                className={`${buttonBase} bg-slate-900 text-white hover:bg-slate-800`}
                onClick={() => {
                  void runSync(false);
                }}
                disabled={syncLoading}
              >
                <Upload className="h-4 w-4" />
                {syncLoading ? "Working..." : "Sync Tours"}
              </button>
            </div>

            {lastSyncResult && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-800">Last sync result</p>
                <p className="mt-1">
                  {lastSyncResult.dryRun ? "Dry run" : "Live sync"} | inserted {" "}
                  <span className="font-semibold">{lastSyncResult.inserted}</span>, updated {" "}
                  <span className="font-semibold">{lastSyncResult.updated}</span>, linked {" "}
                  <span className="font-semibold">{lastSyncResult.linked}</span>, skipped {" "}
                  <span className="font-semibold">{lastSyncResult.skipped}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by tour title, description, hotels..."
                className="w-full rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400/50"
              >
                <option value="all">All Sources</option>
                <option value="global">Global</option>
                <option value="global+local">Global + Local</option>
                <option value="local">Local</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-slate-500" />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-400/50"
              >
                <option value="departure">Sort: Departure</option>
                <option value="price">Sort: Price</option>
                <option value="seats">Sort: Seats</option>
                <option value="title">Sort: Title</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
              Global: {sourceCounts.global}
            </span>
            <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-700">
              Global + Local: {sourceCounts["global+local"]}
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">
              Local: {sourceCounts.local}
            </span>
            <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
              Showing: {sortedTours.length} / {filteredTours.length} filtered
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg font-semibold text-slate-900">Global-Style Tour Cards</h3>
            <p className="text-xs text-slate-500">
              Limited to {TOUR_PREVIEW_LIMIT} cards for fast admin testing.
            </p>
          </div>

          {sortedTours.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-slate-600 font-medium">No tours to display</p>
              <p className="text-sm text-slate-500 mt-1">
                Try changing filters or run fetch from Global API.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedTours.map((tour) => {
                const imageUrl =
                  typeof tour.image_key === "string" && /^https?:\/\//.test(tour.image_key)
                    ? tour.image_key
                    : "";
                const hotels = normalizeHotels(tour.hotels);
                const departure = getPrimaryDepartureDate(tour);
                const departureCount = getTourDepartureCount(tour);
                const sourceTag = tour.source_tag || "local";

                return (
                  <article
                    key={tour.id}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition"
                  >
                    <div className="relative h-48 bg-gradient-to-br from-slate-800 via-slate-700 to-cyan-700">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={tour.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/80 text-sm">
                          No cover image
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      <span
                        className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${sourceBadgeClass(sourceTag)}`}
                      >
                        {sourceLabel(sourceTag)}
                      </span>

                      <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/40 text-white border border-white/20">
                        {departure ? departure.slice(0, 10) : "Date TBD"}
                      </span>
                    </div>

                    <div className="p-4 space-y-3">
                      <h4 className="text-base font-semibold text-slate-900 line-clamp-1">
                        {tour.title}
                      </h4>

                      <p className="text-sm text-slate-600 line-clamp-2 min-h-[2.5rem]">
                        {tour.description || "No description from Global Travel payload."}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {departureCount > 0
                            ? `${departureCount} departure${departureCount > 1 ? "s" : ""}`
                            : "No departures"}
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                          <Users className="h-3.5 w-3.5" />
                          {getTourSeatCount(tour)} seats
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                          <CircleDollarSign className="h-3.5 w-3.5" />
                          {formatPrice(tour.base_price)}
                        </div>
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                          <Building2 className="h-3.5 w-3.5" />
                          {hotels.length} hotels
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {hotels.length > 0 ? (
                          hotels.slice(0, 3).map((hotel) => (
                            <span
                              key={`${tour.id}-${hotel}`}
                              className="px-2 py-1 rounded-md text-xs bg-cyan-50 text-cyan-700 border border-cyan-100"
                            >
                              {hotel}
                            </span>
                          ))
                        ) : (
                          <span className="px-2 py-1 rounded-md text-xs bg-slate-100 text-slate-600">
                            No hotel entries
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 font-mono break-all">
                        ID: {tour.id}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-900">
              Latest Orders From Global Travel
            </h3>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              Showing {ordersPreview.length}/{orders.length}
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2">Order ID</th>
                  <th className="px-2 py-2">Tour</th>
                  <th className="px-2 py-2">Departure</th>
                  <th className="px-2 py-2 text-right">Passengers</th>
                  <th className="px-2 py-2 text-right">Total</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordersPreview.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-5 text-center text-slate-500">
                      No order rows yet. Run fetch orders.
                    </td>
                  </tr>
                ) : (
                  ordersPreview.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-2 py-2 font-mono text-xs text-slate-700">
                        {order.id}
                      </td>
                      <td className="px-2 py-2 text-slate-800">
                        {order.tour || order.tour_title || "-"}
                      </td>
                      <td className="px-2 py-2 text-slate-700">
                        {formatDate(order.departureDate || null)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-700">
                        {Number(order.passenger_count || order.passengers?.length || 0)}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-700">
                        {Number(order.total_price || 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${orderStatusClass(order.status || "")}`}
                        >
                          {order.status || "unknown"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-semibold text-slate-900 inline-flex items-center gap-2">
            <Database className="h-4 w-4" />
            Raw Payload Preview
          </summary>
          <pre className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs overflow-auto max-h-[28rem]">
            {rawPreview}
          </pre>
        </details>
      </div>
    </div>
  );
}
