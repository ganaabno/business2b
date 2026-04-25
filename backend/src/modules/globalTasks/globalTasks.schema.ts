import { badRequest } from "../../shared/http/errors.js";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_SET = new Set(["low", "medium", "high", "urgent"]);

export type CreateGlobalTaskInput = {
  title: string | null;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assigneeIds: string[];
  dueDate: string | null;
  sortOrder: number | null;
};

export type UpdateGlobalTaskInput = {
  title?: string;
  description?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  isCompleted?: boolean;
  assigneeIds?: string[];
  dueDate?: string | null;
};

function parseTaskId(raw: unknown) {
  const id = String(raw || "").trim();
  if (!id) {
    throw badRequest("task id is required");
  }
  return id;
}

function parseAssigneeIds(input: Record<string, unknown>) {
  const assigneeIdsRaw = Array.isArray(input.assigneeIds)
    ? input.assigneeIds
    : (() => {
        const assigneeId = String(input.assigneeId || "").trim();
        if (!assigneeId) return [];
        return [assigneeId];
      })();

  const assigneeIds = assigneeIdsRaw
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(assigneeIds));
}

function parsePriority(value: unknown, fallback: "medium" = "medium") {
  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();

  if (!PRIORITY_SET.has(normalized)) {
    throw badRequest("priority must be one of: low, medium, high, urgent");
  }

  return normalized as "low" | "medium" | "high" | "urgent";
}

function parseDueDate(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const dueDate = String(value).trim().slice(0, 10);
  if (!ISO_DATE_RE.test(dueDate)) {
    throw badRequest("dueDate must be YYYY-MM-DD");
  }

  return dueDate;
}

export function parseGlobalTaskId(raw: unknown) {
  return parseTaskId(raw);
}

export function parseCreateGlobalTaskInput(input: unknown): CreateGlobalTaskInput {
  const value = (input || {}) as Record<string, unknown>;
  const description = String(value.description || "").trim();
  if (!description) {
    throw badRequest("description is required");
  }

  const assigneeIds = parseAssigneeIds(value);
  if (assigneeIds.length === 0) {
    throw badRequest("assigneeIds must include at least one user");
  }

  const titleRaw = String(value.title || "").trim();
  const title = titleRaw || description.split("\n")[0] || null;

  const priority = parsePriority(value.priority, "medium");

  const sortOrderNumber = Number(value.sortOrder);
  const sortOrder =
    value.sortOrder === undefined || value.sortOrder === null || value.sortOrder === ""
      ? null
      : Number.isFinite(sortOrderNumber) && sortOrderNumber >= 1
        ? Math.floor(sortOrderNumber)
        : (() => {
            throw badRequest("sortOrder must be a positive integer");
          })();

  const dueDateParsed = parseDueDate(value.dueDate);

  return {
    title,
    description,
    priority,
    assigneeIds,
    dueDate: dueDateParsed === undefined ? null : dueDateParsed,
    sortOrder,
  };
}

export function parseUpdateGlobalTaskInput(input: unknown): UpdateGlobalTaskInput {
  const value = (input || {}) as Record<string, unknown>;
  const parsed: UpdateGlobalTaskInput = {};

  if (value.title !== undefined) {
    const title = String(value.title || "").trim();
    if (!title) {
      throw badRequest("title cannot be empty");
    }
    parsed.title = title;
  }

  if (value.description !== undefined) {
    const description = String(value.description || "").trim();
    parsed.description = description || null;
  }

  if (value.priority !== undefined) {
    parsed.priority = parsePriority(value.priority, "medium");
  }

  if (value.isCompleted !== undefined) {
    if (typeof value.isCompleted !== "boolean") {
      throw badRequest("isCompleted must be boolean");
    }
    parsed.isCompleted = value.isCompleted;
  }

  if (value.assigneeIds !== undefined || value.assigneeId !== undefined) {
    parsed.assigneeIds = parseAssigneeIds(value);
  }

  const parsedDueDate = parseDueDate(value.dueDate);
  if (parsedDueDate !== undefined) {
    parsed.dueDate = parsedDueDate;
  }

  if (Object.keys(parsed).length === 0) {
    throw badRequest("No valid fields to update");
  }

  return parsed;
}
