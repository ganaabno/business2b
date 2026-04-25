import { format } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  listGlobalMyTasks,
  updateGlobalTask,
  type B2BGlobalTask,
} from "../../api/b2b";
import type { User as UserType } from "../../types/type";
import { getTaskPriorityRank, getTaskPriorityVisual } from "./taskPriority";

type SortKey = "sortOrder" | "dueDate" | "priority" | "createdAt";
type FilterMode = "all" | "active";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "sortOrder", label: "Order" },
  { key: "priority", label: "Priority" },
  { key: "dueDate", label: "Due date" },
  { key: "createdAt", label: "Created" },
];

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

type ManagerTasksTabProps = {
  currentUser: UserType;
};

export default function ManagerTasksTab({ currentUser }: ManagerTasksTabProps) {
  const [tasks, setTasks] = useState<B2BGlobalTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("sortOrder");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const response = await listGlobalMyTasks();
      setTasks(response.data.tasks || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load your tasks";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sortedTasks = useMemo(() => {
    const rows = tasks.filter((task) => {
      if (filterMode === "active") {
        return !task.isCompleted;
      }
      return true;
    });

    rows.sort((left, right) => {
      if (left.isCompleted !== right.isCompleted) {
        return left.isCompleted ? 1 : -1;
      }

      let compareValue = 0;
      if (sortBy === "sortOrder") {
        compareValue = (left.sortOrder || 0) - (right.sortOrder || 0);
      } else if (sortBy === "dueDate") {
        const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : 0;
        const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : 0;
        compareValue = leftDue - rightDue;
      } else if (sortBy === "priority") {
        compareValue =
          getTaskPriorityRank(left.priority) - getTaskPriorityRank(right.priority);
      } else {
        compareValue = left.createdAt.localeCompare(right.createdAt);
      }

      if (compareValue === 0) {
        compareValue = left.createdAt.localeCompare(right.createdAt);
      }

      return sortAsc ? compareValue : -compareValue;
    });

    return rows;
  }, [filterMode, sortAsc, sortBy, tasks]);

  const handleToggleComplete = useCallback(
    async (task: B2BGlobalTask) => {
      setSavingTaskId(task.id);
      try {
        await updateGlobalTask(task.id, {
          isCompleted: !task.isCompleted,
        });
        await loadTasks(true);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update task";
        toast.error(message);
      } finally {
        setSavingTaskId(null);
      }
    },
    [loadTasks],
  );

  const totalCount = tasks.length;
  const activeCount = tasks.filter((task) => !task.isCompleted).length;
  const sortLabel =
    SORT_OPTIONS.find((option) => option.key === sortBy)?.label || "Order";

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  return (
    <div className="mono-card p-5 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="mono-title text-xl text-gray-900">Tasks</h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount} {totalCount === 1 ? "task" : "tasks"} • {activeCount} active
          </p>
        </div>

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

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() =>
            setFilterMode((current) => (current === "all" ? "active" : "all"))
          }
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
            filterMode === "active"
              ? "bg-emerald-50 text-emerald-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Filter className="w-4 h-4" />
          {filterMode === "active" ? "Active" : "All"}
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${sortAsc ? "" : "rotate-180"}`}
            />
            Sort: {sortLabel}
          </button>

          {sortOpen && (
            <div
              className="absolute z-20 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
              onMouseLeave={() => setSortOpen(false)}
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    if (sortBy === option.key) {
                      setSortAsc((current) => !current);
                    } else {
                      setSortBy(option.key);
                      setSortAsc(true);
                    }
                    setSortOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-sm ${
                    sortBy === option.key
                      ? "bg-gray-50 font-medium text-gray-900"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {option.label}
                  {sortBy === option.key && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 ${sortAsc ? "" : "rotate-180"}`}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!isLoading && sortedTasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 py-14 text-center text-gray-500">
          {filterMode === "active"
            ? "No active tasks assigned to your account"
            : "No tasks assigned to your account yet"}
        </div>
      )}

      {sortedTasks.length > 0 && (
        <div className="mono-table-shell">
          <div className="mono-table-scroll">
            <table className="mono-table mono-table--compact min-w-160">
              <thead>
                <tr>
                  <th className="w-12">Done</th>
                  <th>Task</th>
                  <th className="hidden md:table-cell">Due</th>
                  <th className="hidden lg:table-cell">Creator</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  const isSaving = savingTaskId === task.id;
                  const priorityVisual = getTaskPriorityVisual(task.priority);
                  const dueLabel = task.dueDate
                    ? format(new Date(task.dueDate), "MMM d")
                    : null;

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
                        <td onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => void handleToggleComplete(task)}
                            disabled={isSaving}
                            className="inline-flex rounded-full p-0.5 disabled:opacity-60"
                            aria-label={task.isCompleted ? "Mark active" : "Mark complete"}
                          >
                            {isSaving ? (
                              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                            ) : task.isCompleted ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-gray-300" strokeWidth={2} />
                            )}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 max-w-[240px]">
                            <span
                              className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${priorityVisual.dotClassName}`}
                              aria-hidden
                            />
                            <div className="font-medium text-gray-900 truncate min-w-0">
                              {task.title?.trim() || "Task"}
                            </div>
                          </div>
                          {task.approvedAt == null && (
                            <p className="text-xs text-amber-600 mt-0.5">Waiting approval</p>
                          )}
                        </td>
                        <td className="hidden md:table-cell text-gray-600">
                          {dueLabel ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {dueLabel}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="hidden lg:table-cell text-gray-600">
                          {task.creatorName || "-"}
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priorityVisual.badgeClassName} ${task.isCompleted ? "opacity-75" : ""}`}
                          >
                            <span
                              className={`inline-flex h-1.5 w-1.5 rounded-full ${priorityVisual.dotClassName}`}
                              aria-hidden
                            />
                            {priorityVisual.label}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50">
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
                                  Status: {task.approvedAt ? "Approved" : "Pending approval"}
                                </span>
                                <span>
                                  Created: {format(new Date(task.createdAt), "yyyy.MM.dd")}
                                </span>
                              </div>

                              {(task.assigneeNames || []).length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {(task.assigneeNames || []).map((name, index) => {
                                    const assigneeId =
                                      task.assigneeIds?.[index] || task.assigneeId || name;
                                    return (
                                      <span
                                        key={`${assigneeId}-${name}`}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-white border border-gray-200 px-2.5 py-1 text-xs text-gray-700"
                                      >
                                        <span
                                          className="inline-flex w-5 h-5 items-center justify-center rounded-full text-white text-[10px]"
                                          style={{ backgroundColor: avatarColor(String(assigneeId)) }}
                                        >
                                          {getInitials(name)}
                                        </span>
                                        {name}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
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

      {tasks.length === 0 && !isLoading && (
        <button
          type="button"
          onClick={() => void loadTasks()}
          className="mono-button mono-button--ghost"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Load tasks
        </button>
      )}

      {tasks.length > 0 && currentUser.email && (
        <p className="text-xs text-gray-500">
          Showing tasks assigned to <strong>{currentUser.email}</strong>
        </p>
      )}
    </div>
  );
}
