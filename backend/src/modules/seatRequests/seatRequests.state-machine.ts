export type SeatRequestStatus =
  | "pending"
  | "rejected"
  | "approved_waiting_deposit"
  | "confirmed_deposit_paid"
  | "cancelled_expired"
  | "cancelled_by_admin"
  | "cancelled_by_requester"
  | "completed";

export type SeatRequestTransitionAction =
  | "approve"
  | "reject"
  | "deposit_paid"
  | "cancel_expired"
  | "cancel_by_admin"
  | "cancel_by_requester"
  | "complete";

const allowedTransitions: Record<SeatRequestStatus, ReadonlySet<SeatRequestTransitionAction>> = {
  pending: new Set(["approve", "reject", "cancel_by_admin", "cancel_by_requester"]),
  approved_waiting_deposit: new Set(["deposit_paid", "cancel_expired", "cancel_by_admin", "cancel_by_requester"]),
  confirmed_deposit_paid: new Set(["complete", "cancel_by_admin", "cancel_by_requester"]),
  rejected: new Set([]),
  cancelled_expired: new Set([]),
  cancelled_by_admin: new Set([]),
  cancelled_by_requester: new Set([]),
  completed: new Set([]),
};

export function canTransitionSeatRequest(
  current: SeatRequestStatus,
  action: SeatRequestTransitionAction,
): boolean {
  return allowedTransitions[current].has(action);
}
