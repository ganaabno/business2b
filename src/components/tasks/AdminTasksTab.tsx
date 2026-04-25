import { format } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Circle,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  approveGlobalTask,
  listGlobalTasks,
  type B2BGlobalTask,
} from "../../api/b2b";
import type { User as UserType } from "../../types/type";
import AdminTaskAssignPanel from "./AdminTaskAssignPanel";
import { getTaskPriorityVisual } from "./taskPriority";

type FilterMode = "all" | "pending";

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
  }
  return `hsl(${Math.abs(hash % 360)}, 55%, 45%)`;
}

type AdminTasksTabProps = {
  currentUser: UserType;
};

export default function AdminTasksTab({ currentUser }: AdminTasksTabProps) {
  const [tasks, setTasks] = useState<B2BGlobalTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await listGlobalTasks();
      setTasks(response.data.tasks || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load all tasks";
      toast.error(message);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const sortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (filterMode === "pending") {
        return !task.isCompleted && task.approvedAt == null;
      }

      return true;
    });

    return [...filtered].sort((left, right) => {
      const leftOrder = left.sortOrder || 0;
      const rightOrder = right.sortOrder || 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : 0;
      const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : 0;
      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return left.title.localeCompare(right.title);
    });
  }, [filterMode, tasks]);

  const pendingCount = tasks.filter(
    (task) => task.approvedAt == null && !task.isCompleted,
  ).length;

  const handleApproveTask = useCallback(
    async (taskId: string) => {
      setApprovingTaskId(taskId);
      try {
        await approveGlobalTask(taskId);
        toast.success("Task approved");
        await loadTasks(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to approve task";
        toast.error(message);
      } finally {
        setApprovingTaskId(null);
      }
    },
    [loadTasks],
  );

  return (
    <div className="space-y-6">
      <div className="mono-card p-5 sm:p-6">
        <AdminTaskAssignPanel currentUser={currentUser} onCreated={() => void loadTasks()} />
      </div>

      <div className="mono-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div>
            <h3 className="mono-title text-lg text-gray-900">All Tasks</h3>
            <p className="text-sm text-gray-500 mt-1">
              Review all assigned tasks and approve pending items.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFilterMode((current) =>
                  current === "all" ? "pending" : "all",
                )
              }
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                filterMode === "pending"
                  ? "bg-amber-50 text-amber-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Filter className="w-4 h-4" />
              {filterMode === "pending" ? "Pending only" : "Filter"}
              {filterMode === "all" && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => void loadTasks()}
              className="mono-button mono-button--ghost mono-button--sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-14 text-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            Loading tasks...
          </div>
        ) : sortedTasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            {filterMode === "pending"
              ? "No pending tasks waiting for approval"
              : "No tasks returned from Global"}
          </div>
        ) : (
          <div className="mono-table-shell">
            <div className="mono-table-scroll">
              <table className="mono-table mono-table--compact min-w-180">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Task</th>
                    <th>Assignees</th>
                    <th className="hidden md:table-cell">Creator</th>
                    <th>Priority</th>
                    <th className="hidden sm:table-cell">Due</th>
                    <th>Approved</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map((task) => {
                    const isExpanded = expandedTaskId === task.id;
                    const isPendingApproval = task.approvedAt == null;
                    const priorityVisual = getTaskPriorityVisual(task.priority);
                    const due = task.dueDate
                      ? format(new Date(task.dueDate), "MMM d")
                      : null;
                    const isApproving = approvingTaskId === task.id;

                    return (
                      <Fragment key={task.id}>
                        <tr
                          className={`cursor-pointer ${task.isCompleted ? "opacity-60" : ""}`}
                          onClick={() =>
                            setExpandedTaskId((current) =>
                              current === task.id ? null : task.id,
                            )
                          }
                        >
                          <td className="font-medium text-gray-500">{task.sortOrder}</td>
                          <td>
                            <span className="flex items-center gap-2 max-w-[220px]">
                              <span
                                className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${priorityVisual.dotClassName}`}
                                aria-hidden
                              />
                              <span className="font-medium text-gray-900 truncate block min-w-0">
                                {task.title?.trim() || "-"}
                              </span>
                            </span>
                          </td>
                          <td>
                            {(task.assigneeNames || []).length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {(task.assigneeNames || []).map((name, index) => (
                                  <span key={`${name}-${index}`} className="inline-flex items-center gap-1 text-xs text-gray-700">
                                    <span
                                      className="inline-flex w-6 h-6 items-center justify-center rounded-full text-white text-[10px]"
                                      style={{
                                        backgroundColor: avatarColor(
                                          String(task.assigneeIds?.[index] || task.assigneeId || index),
                                        ),
                                      }}
                                    >
                                      {getInitials(name)}
                                    </span>
                                    <span className="hidden sm:inline max-w-[90px] truncate">
                                      {name}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="hidden md:table-cell text-gray-600">
                            {task.creatorName || "-"}
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityVisual.badgeClassName}`}
                            >
                              <span
                                className={`inline-flex h-1.5 w-1.5 rounded-full ${priorityVisual.dotClassName}`}
                                aria-hidden
                              />
                              {priorityVisual.label}
                            </span>
                          </td>
                          <td className="hidden sm:table-cell text-gray-600">
                            {due ? (
                              <span className="inline-flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {due}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            {isPendingApproval ? (
                              <Circle className="w-5 h-5 text-gray-300" strokeWidth={2} />
                            ) : (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            )}
                          </td>
                          <td
                            className="text-right"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {!task.isCompleted && isPendingApproval && (
                              <button
                                type="button"
                                onClick={() => void handleApproveTask(task.id)}
                                disabled={isApproving}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                              >
                                {isApproving ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Approve
                              </button>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="bg-gray-50">
                              <div className="space-y-3 py-2">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {task.description?.trim() || "No description"}
                                </p>

                                <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                                  {task.creatorName && <span>Creator: {task.creatorName}</span>}
                                  {task.dueDate && (
                                    <span>
                                      Due: {format(new Date(task.dueDate), "yyyy.MM.dd")}
                                    </span>
                                  )}
                                  <span>
                                    {isPendingApproval ? "Pending approval" : "Approved"}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
