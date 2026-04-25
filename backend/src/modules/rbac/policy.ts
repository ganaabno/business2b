import type { AppRole } from "../../shared/types/auth.js";

export type Action =
  | "tours:sync"
  | "tours:sync:raw"
  | "tours:sync:canonical"
  | "users:view"
  | "users:manage"
  | "seatRequest:create"
  | "seatRequest:view:own"
  | "seatRequest:view:all"
  | "seatRequest:approve"
  | "seatRequest:reject"
  | "seatAccessRequest:create"
  | "seatAccessRequest:approve"
  | "seatAccessRequest:reject"
  | "seatAccessRequest:selectTour"
  | "payments:monitor"
  | "bindingRequest:create"
  | "bindingRequest:approve"
  | "bindingRequest:reject"
  | "organizations:view:own"
  | "organizations:view:all"
  | "organizations:create";

const permissions: Record<AppRole, ReadonlySet<Action>> = {
  admin: new Set([
    "tours:sync",
    "tours:sync:raw",
    "tours:sync:canonical",
    "users:view",
    "users:manage",
    "seatRequest:create",
    "seatRequest:view:own",
    "seatRequest:view:all",
    "seatRequest:approve",
    "seatRequest:reject",
    "seatAccessRequest:create",
    "seatAccessRequest:selectTour",
    "seatAccessRequest:approve",
    "seatAccessRequest:reject",
    "payments:monitor",
    "bindingRequest:create",
    "bindingRequest:approve",
    "bindingRequest:reject",
    "organizations:view:own",
    "organizations:view:all",
    "organizations:create",
  ]),
  manager: new Set([
    "tours:sync",
    "tours:sync:raw",
    "tours:sync:canonical",
    "seatRequest:view:all",
    "seatRequest:approve",
    "seatRequest:reject",
    "seatAccessRequest:create",
    "seatAccessRequest:selectTour",
    "seatAccessRequest:approve",
    "seatAccessRequest:reject",
    "payments:monitor",
    "bindingRequest:approve",
    "bindingRequest:reject",
    "organizations:view:all",
  ]),
  subcontractor: new Set([
    "tours:sync:canonical",
    "seatRequest:create",
    "seatRequest:view:own",
    "seatAccessRequest:create",
    "seatAccessRequest:selectTour",
    "bindingRequest:create",
    "organizations:view:own",
    "organizations:create",
  ]),
  agent: new Set([
    "tours:sync:canonical",
    "seatRequest:create",
    "seatRequest:view:own",
    "seatAccessRequest:create",
    "seatAccessRequest:selectTour",
    "bindingRequest:create",
    "organizations:view:own",
    "organizations:create",
  ]),
};

export function can(role: AppRole, action: Action): boolean {
  return permissions[role].has(action);
}
