import { Loader2, Plus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  createGlobalTask,
  listGlobalTaskAssignees,
  type B2BGlobalTaskAssignee,
  type B2BTaskPriority,
} from "../../api/b2b";
import type { User as UserType } from "../../types/type";
import { getTaskPriorityVisual } from "./taskPriority";

const PRIORITY_OPTIONS: { value: B2BTaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

type AdminTaskAssignPanelProps = {
  currentUser: UserType;
  onCreated: () => void;
};

export default function AdminTaskAssignPanel({
  currentUser,
  onCreated,
}: AdminTaskAssignPanelProps) {
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<B2BTaskPriority>("medium");
  const [sortOrder, setSortOrder] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [assignees, setAssignees] = useState<B2BGlobalTaskAssignee[]>([]);

  const loadAssignees = useCallback(async () => {
    setIsLoadingAssignees(true);
    try {
      const response = await listGlobalTaskAssignees();
      setAssignees(response.data.users || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load assignees";
      toast.error(message);
      setAssignees([]);
    } finally {
      setIsLoadingAssignees(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignees();
  }, [loadAssignees]);

  const assigneeById = useMemo(() => {
    return new Map(assignees.map((assignee) => [assignee.id, assignee]));
  }, [assignees]);

  const selectedPriorityVisual = getTaskPriorityVisual(priority);

  const openForm = () => {
    setShowForm(true);
    const shouldPreselectCurrentUser = assignees.some(
      (assignee) => assignee.email === currentUser.email,
    );
    if (shouldPreselectCurrentUser) {
      const currentAssignee = assignees.find(
        (assignee) => assignee.email === currentUser.email,
      );
      setAssigneeIds(currentAssignee ? [currentAssignee.id] : []);
    } else {
      setAssigneeIds([]);
    }
  };

  const handleCreateTask = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      toast.error("Task description is required");
      return;
    }

    const ids = Array.from(new Set(assigneeIds.filter(Boolean)));
    if (ids.length === 0) {
      toast.error("Select at least one assignee");
      return;
    }

    const firstLine = trimmedDescription.split("\n")[0] || trimmedDescription;

    setIsSubmitting(true);
    try {
      await createGlobalTask({
        title: firstLine,
        description: trimmedDescription,
        assigneeIds: ids,
        priority,
        sortOrder: sortOrder === "" ? null : sortOrder,
        dueDate: dueDate || null,
      });

      toast.success("Task created");
      setDescription("");
      setAssigneeIds([]);
      setPriority("medium");
      setSortOrder("");
      setDueDate("");
      setShowForm(false);
      onCreated();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create task";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h3 className="mono-title text-lg text-gray-900 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-sky-600" />
          Assign Tasks
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Select assignees, set priority/order, and assign work directly to Global
          Travel.
        </p>
      </header>

      {!showForm ? (
        <button
          type="button"
          onClick={openForm}
          className="w-full rounded-2xl border-2 border-dashed border-sky-300 py-8 text-sky-700 font-medium hover:border-sky-500 hover:bg-sky-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create new task
        </button>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assignees (multi-select)
            </label>

            <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-300 bg-white p-2 space-y-1">
              {isLoadingAssignees && (
                <div className="text-sm text-gray-500 px-2 py-1">Loading assignees...</div>
              )}

              {!isLoadingAssignees && assignees.length === 0 && (
                <div className="text-sm text-gray-500 px-2 py-1">No assignees returned</div>
              )}

              {assignees.map((assignee) => {
                const fullName =
                  `${assignee.lastname || ""} ${assignee.firstname || ""}`.trim() ||
                  assignee.email;
                const isSelected = assigneeIds.includes(assignee.id);

                return (
                  <label
                    key={assignee.id}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                      isSelected ? "bg-sky-50 text-sky-800" : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setAssigneeIds((current) => [...current, assignee.id]);
                          return;
                        }

                        setAssigneeIds((current) =>
                          current.filter((value) => value !== assignee.id),
                        );
                      }}
                      className="h-4 w-4"
                    />

                    <span className="text-sm text-gray-800">
                      {fullName} ({assignee.role || "-"})
                    </span>
                  </label>
                );
              })}
            </div>

            {assigneeIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {assigneeIds.map((id) => {
                  const assignee = assigneeById.get(id);
                  const label = assignee
                    ? `${assignee.lastname || ""} ${assignee.firstname || ""}`.trim() ||
                      assignee.email
                    : id;

                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-800"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={() =>
                          setAssigneeIds((current) =>
                            current.filter((value) => value !== id),
                          )
                        }
                        className="rounded-full p-0.5 hover:bg-sky-200"
                        aria-label="Remove assignee"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the task..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort order (#)
              </label>
              <input
                type="number"
                min={1}
                value={sortOrder}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!raw) {
                    setSortOrder("");
                    return;
                  }
                  const parsed = Math.max(1, Number.parseInt(raw, 10) || 1);
                  setSortOrder(parsed);
                }}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as B2BTaskPriority)
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Selected:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${selectedPriorityVisual.badgeClassName}`}
                >
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full ${selectedPriorityVisual.dotClassName}`}
                    aria-hidden
                  />
                  {selectedPriorityVisual.label}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleCreateTask()}
              disabled={isSubmitting}
              className="mono-button mono-button--sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Assign
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setDescription("");
                setAssigneeIds([]);
                setPriority("medium");
                setSortOrder("");
                setDueDate("");
              }}
              className="mono-button mono-button--ghost mono-button--sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
