import { q } from "../../db/transaction.js";
import {
  approveGlobalTask,
  createGlobalTask,
  listGlobalTaskAssignees,
  listGlobalTasks,
  type GlobalTaskAssigneeRecord,
  type GlobalTaskRecord,
  updateGlobalTask,
} from "../../integrations/globalTravel/globalTasks.client.js";
import { badRequest, forbidden, notFound } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import type {
  CreateGlobalTaskInput,
  UpdateGlobalTaskInput,
} from "./globalTasks.schema.js";

type LocalEmailRow = {
  email: string | null;
};

function canUseTaskModule(user: AuthUser) {
  return user.role === "admin" || user.role === "manager";
}

function canManageAllTasks(user: AuthUser) {
  return user.role === "admin";
}

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getTaskAssigneeIds(task: GlobalTaskRecord) {
  const ids = Array.isArray(task.assigneeIds)
    ? task.assigneeIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (ids.length > 0) {
    return Array.from(new Set(ids));
  }

  const fallback = String(task.assigneeId || "").trim();
  return fallback ? [fallback] : [];
}

function getGlobalTaskById(tasks: GlobalTaskRecord[], taskId: string) {
  return tasks.find((task) => String(task.id) === taskId) || null;
}

async function resolveLocalUserEmail(user: AuthUser) {
  const { rows } = await q<LocalEmailRow>(
    `
    select nullif(trim(u.email), '') as email
    from public.users u
    where u.id::text = $1::text
       or coalesce(
         nullif(to_jsonb(u) ->> 'auth_user_id', ''),
         nullif(to_jsonb(u) ->> 'userid', '')
       ) = $1::text
    limit 1
    `,
    [user.id],
  );

  return normalizeEmail(rows[0]?.email || "");
}

function mapEmailToAssigneeIds(
  assignees: GlobalTaskAssigneeRecord[],
  email: string,
) {
  if (!email) return new Set<string>();

  const ids = assignees
    .filter((assignee) => normalizeEmail(assignee.email) === email)
    .map((assignee) => String(assignee.id || "").trim())
    .filter((id) => id.length > 0);

  return new Set(ids);
}

function taskBelongsToAssigneeSet(task: GlobalTaskRecord, assigneeIds: Set<string>) {
  if (assigneeIds.size === 0) return false;
  const taskAssignees = getTaskAssigneeIds(task);
  return taskAssignees.some((assigneeId) => assigneeIds.has(assigneeId));
}

function sanitizeCreatePayload(input: CreateGlobalTaskInput) {
  return {
    title: input.title,
    description: input.description,
    priority: input.priority,
    assigneeIds: input.assigneeIds,
    dueDate: input.dueDate,
    sortOrder: input.sortOrder,
  } satisfies Record<string, unknown>;
}

function sanitizeUpdatePayload(input: UpdateGlobalTaskInput) {
  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.priority !== undefined) payload.priority = input.priority;
  if (input.isCompleted !== undefined) payload.isCompleted = input.isCompleted;
  if (input.assigneeIds !== undefined) payload.assigneeIds = input.assigneeIds;
  if (input.dueDate !== undefined) payload.dueDate = input.dueDate;

  return payload;
}

function managerCanOnlyToggleCompletion(input: UpdateGlobalTaskInput) {
  const keys = Object.keys(input);
  return keys.length === 1 && keys[0] === "isCompleted";
}

export async function listTaskAssigneesService(user: AuthUser) {
  if (!canUseTaskModule(user)) {
    throw forbidden("Tasks are only available for manager/admin");
  }

  const users = await listGlobalTaskAssignees();
  return { users };
}

export async function listMyTasksService(user: AuthUser) {
  if (!canUseTaskModule(user)) {
    throw forbidden("Tasks are only available for manager/admin");
  }

  const [localEmail, assignees, tasks] = await Promise.all([
    resolveLocalUserEmail(user),
    listGlobalTaskAssignees(),
    listGlobalTasks(),
  ]);

  if (!localEmail) {
    return { tasks: [] as GlobalTaskRecord[] };
  }

  const localAssigneeIds = mapEmailToAssigneeIds(assignees, localEmail);
  if (localAssigneeIds.size === 0) {
    return { tasks: [] as GlobalTaskRecord[] };
  }

  const filtered = tasks.filter((task) => taskBelongsToAssigneeSet(task, localAssigneeIds));
  return { tasks: filtered };
}

export async function listAllTasksService(user: AuthUser) {
  if (!canManageAllTasks(user)) {
    throw forbidden("Only admin/superadmin can view all tasks");
  }

  const tasks = await listGlobalTasks();
  return { tasks };
}

export async function createTaskService(user: AuthUser, input: CreateGlobalTaskInput) {
  if (!canManageAllTasks(user)) {
    throw forbidden("Only admin/superadmin can create tasks");
  }

  const task = await createGlobalTask(sanitizeCreatePayload(input));
  return { task };
}

export async function updateTaskService(
  user: AuthUser,
  taskId: string,
  input: UpdateGlobalTaskInput,
) {
  if (!canUseTaskModule(user)) {
    throw forbidden("Tasks are only available for manager/admin");
  }

  if (user.role === "manager") {
    if (!managerCanOnlyToggleCompletion(input) || input.isCompleted === undefined) {
      throw forbidden("Managers can only toggle completion on their assigned tasks");
    }

    const [localEmail, assignees, tasks] = await Promise.all([
      resolveLocalUserEmail(user),
      listGlobalTaskAssignees(),
      listGlobalTasks(),
    ]);

    if (!localEmail) {
      throw forbidden("Your account email is not mapped for task updates");
    }

    const localAssigneeIds = mapEmailToAssigneeIds(assignees, localEmail);
    const existingTask = getGlobalTaskById(tasks, taskId);
    if (!existingTask) {
      throw notFound("Task not found");
    }

    if (!taskBelongsToAssigneeSet(existingTask, localAssigneeIds)) {
      throw forbidden("Managers can only update tasks assigned to their own account");
    }

    if (
      input.isCompleted === true &&
      !existingTask.isCompleted &&
      !existingTask.approvedAt
    ) {
      throw badRequest("Task must be approved before it can be marked as completed");
    }
  }

  const task = await updateGlobalTask(taskId, sanitizeUpdatePayload(input));
  return { task };
}

export async function approveTaskService(user: AuthUser, taskId: string) {
  if (!canManageAllTasks(user)) {
    throw forbidden("Only admin/superadmin can approve tasks");
  }

  const task = await approveGlobalTask(taskId);
  return { task };
}
