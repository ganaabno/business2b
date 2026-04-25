import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, UserPlus, X } from "lucide-react";
import { supabase } from "../supabaseClient";
import type { Tour } from "../types/type";

interface ProviderAssignmentsTabProps {
  tours: Tour[];
  currentUser: {
    id: string;
  };
  showNotification: (type: "success" | "error", message: string) => void;
  onOpenProviderPreview: () => void;
}

interface ProviderUserOption {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string | null;
  role_v2?: string | null;
}

interface TourProviderAssignment {
  id: string;
  tour_id: string;
  provider_user_id: string;
  created_at: string;
}

const isMissingRelation = (error: unknown) => {
  const anyError = error as any;
  const code = String(anyError?.code ?? "");
  const message = String(anyError?.message ?? "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || message.includes("does not exist");
};

const isMissingColumn = (error: unknown) => {
  const anyError = error as any;
  const code = String(anyError?.code ?? "");
  const message = String(anyError?.message ?? "").toLowerCase();
  return code === "42703" || message.includes("column") || message.includes("role_v2");
};

const providerDisplayName = (user?: ProviderUserOption | null) => {
  if (!user) return "Unknown provider";
  const fullName = [user.last_name, user.first_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username && user.username.trim()) return user.username;
  if (user.email && user.email.trim()) return user.email;
  return user.id;
};

export default function ProviderAssignmentsTab({
  tours,
  currentUser,
  showNotification,
  onOpenProviderPreview,
}: ProviderAssignmentsTabProps) {
  const [loading, setLoading] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [providerUsers, setProviderUsers] = useState<ProviderUserOption[]>([]);
  const [assignments, setAssignments] = useState<TourProviderAssignment[]>([]);
  const [selectedProviderByTour, setSelectedProviderByTour] = useState<
    Record<string, string>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [focusedProviderId, setFocusedProviderId] = useState("");
  const [focusedAssignmentFilter, setFocusedAssignmentFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const providerUserMap = useMemo(
    () =>
      providerUsers.reduce<Record<string, ProviderUserOption>>((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {}),
    [providerUsers],
  );

  const assignmentsByTour = useMemo(() => {
    return assignments.reduce<Record<string, TourProviderAssignment[]>>((acc, row) => {
      if (!acc[row.tour_id]) {
        acc[row.tour_id] = [];
      }
      acc[row.tour_id].push(row);
      return acc;
    }, {});
  }, [assignments]);

  const focusedProvider = focusedProviderId
    ? providerUserMap[focusedProviderId] || null
    : null;

  const focusedProviderTourIds = useMemo(() => {
    if (!focusedProviderId) return new Set<string>();
    return new Set(
      assignments
        .filter((row) => row.provider_user_id === focusedProviderId)
        .map((row) => row.tour_id),
    );
  }, [assignments, focusedProviderId]);

  const filteredTours = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const sorted = [...tours].sort((a, b) => {
      const aDate = a.departure_date || "";
      const bDate = b.departure_date || "";
      return aDate.localeCompare(bDate);
    });

    return sorted.filter((tour) => {
      const isAssigned = (assignmentsByTour[tour.id] || []).length > 0;
      const isAssignedToFocusedProvider = focusedProviderTourIds.has(tour.id);

      if (assignmentFilter === "assigned" && !isAssigned) return false;
      if (assignmentFilter === "unassigned" && isAssigned) return false;

      if (focusedAssignmentFilter === "assigned" && !isAssignedToFocusedProvider) {
        return false;
      }
      if (focusedAssignmentFilter === "unassigned" && isAssignedToFocusedProvider) {
        return false;
      }

      if (!term) return true;

      const haystack = [
        tour.title,
        tour.name,
        tour.tour_number,
        tour.departure_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [
    tours,
    searchTerm,
    assignmentFilter,
    assignmentsByTour,
    focusedAssignmentFilter,
    focusedProviderTourIds,
  ]);

  const assignedToursCount = useMemo(
    () => tours.filter((tour) => (assignmentsByTour[tour.id] || []).length > 0).length,
    [tours, assignmentsByTour],
  );

  const unassignedToursCount = tours.length - assignedToursCount;

  const focusedAssignedToursCount = focusedProviderTourIds.size;
  const focusedUnassignedToursCount = Math.max(
    tours.length - focusedAssignedToursCount,
    0,
  );

  const loadAssignments = useCallback(async () => {
    const { data, error } = await supabase
      .from("tour_provider_assignments")
      .select("id, tour_id, provider_user_id, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingRelation(error)) {
        setSchemaMissing(true);
        setAssignments([]);
        return false;
      }
      throw error;
    }

    setSchemaMissing(false);
    setAssignments(
      (data || []).map((row: any) => ({
        id: String(row.id),
        tour_id: String(row.tour_id),
        provider_user_id: String(row.provider_user_id),
        created_at: String(row.created_at || ""),
      })),
    );
    return true;
  }, []);

  const loadProviders = useCallback(async () => {
    const withRoleV2 = await supabase
      .from("users")
      .select("id, email, first_name, last_name, username, role, role_v2")
      .or("role.eq.provider,role.eq.agent,role_v2.eq.agent");

    let rows: any[] | null = (withRoleV2.data as any[] | null) ?? null;
    let queryError: any = withRoleV2.error;

    if (queryError && isMissingColumn(queryError)) {
      const withoutRoleV2 = await supabase
        .from("users")
        .select("id, email, first_name, last_name, username, role")
        .or("role.eq.provider,role.eq.agent");
      rows = (withoutRoleV2.data as any[] | null) ?? null;
      queryError = withoutRoleV2.error;
    }

    if (queryError) {
      throw queryError;
    }

    const normalized = Array.from(
      new Map(
        (rows || []).map((row: any) => {
          const normalizedRow: ProviderUserOption = {
            id: String(row.id),
            email: String(row.email || ""),
            first_name:
              row.first_name !== null && row.first_name !== undefined
                ? String(row.first_name)
                : null,
            last_name:
              row.last_name !== null && row.last_name !== undefined
                ? String(row.last_name)
                : null,
            username:
              row.username !== null && row.username !== undefined
                ? String(row.username)
                : null,
            role:
              row.role !== null && row.role !== undefined
                ? String(row.role)
                : null,
            role_v2:
              row.role_v2 !== null && row.role_v2 !== undefined
                ? String(row.role_v2)
                : null,
          };
          return [normalizedRow.id, normalizedRow] as const;
        }),
      ).values(),
    ).sort((a, b) => providerDisplayName(a).localeCompare(providerDisplayName(b)));

    setProviderUsers(normalized);
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const tableReady = await loadAssignments();
      if (!tableReady) {
        setProviderUsers([]);
        return;
      }
      await loadProviders();
    } catch (error: any) {
      showNotification("error", error?.message || "Failed to load provider assignments");
    } finally {
      setLoading(false);
    }
  }, [loadAssignments, loadProviders, showNotification]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (providerUsers.length === 0) {
      setFocusedProviderId("");
      return;
    }

    setFocusedProviderId((prev) => {
      if (prev && providerUsers.some((provider) => provider.id === prev)) {
        return prev;
      }
      return providerUsers[0].id;
    });
  }, [providerUsers]);

  useEffect(() => {
    if (schemaMissing) return;

    const channel = supabase
      .channel("manager-provider-assignments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tour_provider_assignments" },
        () => {
          void loadAssignments();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [schemaMissing, loadAssignments]);

  const addAssignmentForProvider = async (
    tourId: string,
    providerUserIdRaw: string,
  ) => {
    const providerUserId = String(providerUserIdRaw || "").trim();
    if (!providerUserId) {
      showNotification("error", "Choose a provider first.");
      return;
    }

    if (
      (assignmentsByTour[tourId] || []).some(
        (row) => row.provider_user_id === providerUserId,
      )
    ) {
      showNotification("error", "This provider is already assigned to the tour.");
      return;
    }

    const actionKey = `assign:${tourId}:${providerUserId}`;
    setBusyKey(actionKey);

    try {
      const { data, error } = await supabase
        .from("tour_provider_assignments")
        .insert({
          tour_id: tourId,
          provider_user_id: providerUserId,
          created_by: currentUser.id,
        })
        .select("id, tour_id, provider_user_id, created_at")
        .single();

      if (error) {
        if (String((error as any)?.code || "") === "23505") {
          showNotification("error", "This provider is already assigned to the tour.");
          return;
        }
        throw error;
      }

      setAssignments((prev) => [
        {
          id: String(data.id),
          tour_id: String(data.tour_id),
          provider_user_id: String(data.provider_user_id),
          created_at: String(data.created_at || ""),
        },
        ...prev,
      ]);
      setSelectedProviderByTour((prev) => ({ ...prev, [tourId]: "" }));
      showNotification("success", "Provider assigned to tour.");
    } catch (error: any) {
      showNotification("error", error?.message || "Failed to assign provider.");
    } finally {
      setBusyKey(null);
    }
  };

  const addAssignment = async (tourId: string) => {
    const providerUserId = String(selectedProviderByTour[tourId] || "").trim();
    await addAssignmentForProvider(tourId, providerUserId);
  };

  const removeAssignment = async (assignment: TourProviderAssignment) => {
    const actionKey = `remove:${assignment.id}`;
    setBusyKey(actionKey);

    try {
      const { error } = await supabase
        .from("tour_provider_assignments")
        .delete()
        .eq("id", assignment.id);

      if (error) throw error;

      setAssignments((prev) => prev.filter((row) => row.id !== assignment.id));
      showNotification("success", "Provider unassigned from tour.");
    } catch (error: any) {
      showNotification("error", error?.message || "Failed to remove assignment.");
    } finally {
      setBusyKey(null);
    }
  };

  const toggleFocusedProviderAssignment = async (tourId: string) => {
    const providerUserId = String(focusedProviderId || "").trim();
    if (!providerUserId) {
      showNotification("error", "Select a focus provider first.");
      return;
    }

    const existing = (assignmentsByTour[tourId] || []).find(
      (row) => row.provider_user_id === providerUserId,
    );

    if (existing) {
      await removeAssignment(existing);
      return;
    }

    await addAssignmentForProvider(tourId, providerUserId);
  };

  if (schemaMissing) {
    return (
      <div className="mono-card p-6 mono-stack-tight">
        <h2 className="mono-title text-xl">Provider Access</h2>
        <p className="mono-subtitle text-sm">
          Provider assignment table is not available yet.
        </p>
        <p className="text-sm text-gray-600">
          Run migration `supabase/migrations/20260305_tour_provider_assignments.sql` to enable
          tour-level provider assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="mono-stack">
      <div className="mono-card p-6">
        <div className="mono-stack-tight">
          <h2 className="mono-title text-xl">Provider Access</h2>
          <p className="mono-subtitle text-sm">
            Define what each provider can work on by assigning tours. Provider interface will only
            show assigned tours, orders, and passengers.
          </p>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="mono-panel p-3">
              <p className="mono-kicker">Assigned Tours</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{assignedToursCount}</p>
            </div>
            <div className="mono-panel p-3">
              <p className="mono-kicker">Unassigned Tours</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{unassignedToursCount}</p>
            </div>
            <div className="mono-panel p-3">
              <p className="mono-kicker">Total Assignments</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{assignments.length}</p>
            </div>
            <div className="mono-panel p-3">
              <p className="mono-kicker">Providers</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{providerUsers.length}</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="mono-panel p-4 lg:col-span-2">
              <p className="text-sm font-semibold text-gray-900">Provider workflow</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-gray-600">
                <p>1) See assigned tours and related orders only.</p>
                <p>2) Complete booking confirmation details.</p>
                <p>3) Update passenger records for assigned tours.</p>
                <p>4) No access to tours without assignment.</p>
              </div>
            </div>

            <div className="mono-panel p-4 mono-stack-tight">
              <p className="text-sm font-semibold text-gray-900">Focus Provider</p>
              <select
                value={focusedProviderId}
                onChange={(event) => setFocusedProviderId(event.target.value)}
                className="mono-select"
              >
                <option value="">Select provider</option>
                {providerUsers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {providerDisplayName(provider)}
                  </option>
                ))}
              </select>

              {focusedProvider ? (
                <div className="text-xs text-gray-600 space-y-1">
                  <p>
                    Assigned tours: <span className="font-semibold">{focusedAssignedToursCount}</span>
                  </p>
                  <p>
                    Unassigned tours: <span className="font-semibold">{focusedUnassignedToursCount}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">Select provider to speed up assignment actions.</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search tours"
                className="mono-input w-full sm:w-64"
              />
              <select
                value={assignmentFilter}
                onChange={(event) =>
                  setAssignmentFilter(
                    event.target.value as "all" | "assigned" | "unassigned",
                  )
                }
                className="mono-select w-full sm:w-44"
              >
                <option value="all">All tours</option>
                <option value="assigned">Assigned only</option>
                <option value="unassigned">Unassigned only</option>
              </select>

              <select
                value={focusedAssignmentFilter}
                onChange={(event) =>
                  setFocusedAssignmentFilter(
                    event.target.value as "all" | "assigned" | "unassigned",
                  )
                }
                className="mono-select w-full sm:w-56"
                disabled={!focusedProviderId}
              >
                <option value="all">Focus provider: all tours</option>
                <option value="assigned">Focus provider: assigned</option>
                <option value="unassigned">Focus provider: unassigned</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void refreshData();
                }}
                className="mono-button mono-button--ghost"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </button>
              <button
                type="button"
                onClick={onOpenProviderPreview}
                className="mono-button"
              >
                View As Provider
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mono-table-shell">
        <div className="mono-table-scroll">
          <table className="mono-table mono-table--sticky">
            <thead>
              <tr>
                <th className="w-[34%]">Tour</th>
                <th className="w-[36%]">Assigned Providers</th>
                <th className="w-[30%]">Add Provider</th>
              </tr>
            </thead>
            <tbody>
              {filteredTours.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-sm text-gray-500">
                    No tours found.
                  </td>
                </tr>
              ) : (
                filteredTours.map((tour) => {
                  const tourAssignments = assignmentsByTour[tour.id] || [];
                  const selectedProvider = selectedProviderByTour[tour.id] || "";
                  const assignBusy =
                    !!selectedProvider &&
                    busyKey === `assign:${tour.id}:${selectedProvider}`;
                  const focusedAssignment = focusedProviderId
                    ? tourAssignments.find(
                        (assignment) => assignment.provider_user_id === focusedProviderId,
                      )
                    : null;
                  const focusedBusy =
                    (focusedProviderId &&
                      busyKey === `assign:${tour.id}:${focusedProviderId}`) ||
                    (focusedAssignment && busyKey === `remove:${focusedAssignment.id}`);

                  return (
                    <tr key={tour.id}>
                      <td className="align-top">
                        <div className="mono-stack-tight">
                          <p className="font-semibold text-gray-900">{tour.title || "Untitled Tour"}</p>
                          <p className="text-xs text-gray-500">
                            #{tour.tour_number || tour.id.slice(0, 6)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Departure: {tour.departure_date || "Not set"}
                          </p>
                        </div>
                      </td>

                      <td className="align-top">
                        {tourAssignments.length === 0 ? (
                          <span className="text-xs text-gray-500">No assigned providers</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {tourAssignments.map((assignment) => {
                              const user = providerUserMap[assignment.provider_user_id];
                              const removeBusy = busyKey === `remove:${assignment.id}`;
                              return (
                                <span key={assignment.id} className="mono-badge">
                                  {providerDisplayName(user)}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void removeAssignment(assignment);
                                    }}
                                    className="inline-flex items-center justify-center text-gray-500 hover:text-gray-800"
                                    disabled={removeBusy}
                                    title="Unassign provider"
                                  >
                                    {removeBusy ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <X className="w-3 h-3" />
                                    )}
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="align-top">
                        <div className="flex flex-col gap-2">
                          {focusedProviderId && (
                            <button
                              type="button"
                              onClick={() => {
                                void toggleFocusedProviderAssignment(tour.id);
                              }}
                              className="mono-button mono-button--subtle w-full sm:w-auto"
                              disabled={!!focusedBusy}
                            >
                              {focusedBusy ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : null}
                              {focusedAssignment
                                ? `Unassign ${providerDisplayName(focusedProvider)}`
                                : `Assign ${providerDisplayName(focusedProvider)}`}
                            </button>
                          )}

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={selectedProvider}
                            onChange={(event) =>
                              setSelectedProviderByTour((prev) => ({
                                ...prev,
                                [tour.id]: event.target.value,
                              }))
                            }
                            className="mono-select"
                          >
                            <option value="">Select provider</option>
                            {providerUsers.map((provider) => (
                              <option key={provider.id} value={provider.id}>
                                {providerDisplayName(provider)}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              void addAssignment(tour.id);
                            }}
                            className="mono-button"
                            disabled={assignBusy || providerUsers.length === 0}
                          >
                            {assignBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserPlus className="w-4 h-4" />
                            )}
                            Assign
                          </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
