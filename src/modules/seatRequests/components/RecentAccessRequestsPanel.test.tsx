import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  B2BSeatAccessRequestRow,
  B2BSeatRequestRow,
} from "../../../api/b2b";
import RecentAccessRequestsPanel from "./RecentAccessRequestsPanel";

function buildAccessRequest(
  overrides: Partial<B2BSeatAccessRequestRow> = {},
): B2BSeatAccessRequestRow {
  return {
    id: "access-1",
    requester_user_id: "user-1",
    organization_id: "org-1",
    organization_name: "Org",
    requester_role: "agent",
    from_date: "2026-06-01",
    to_date: "2026-06-05",
    destination: "Seoul",
    planned_seats: 2,
    note: "note",
    status: "approved",
    decision_reason: "approved",
    reviewed_by: null,
    reviewed_by_email: null,
    reviewed_at: null,
    approved_at: "2026-05-20T00:00:00.000Z",
    expires_at: null,
    consumed_at: null,
    seat_request_id: "seat-1",
    serial_count: 1,
    serial_group_id: null,
    created_at: "2026-05-18T00:00:00.000Z",
    updated_at: "2026-05-18T00:00:00.000Z",
    requester_first_name: null,
    requester_last_name: null,
    requester_username: null,
    requester_email: "agent@example.com",
    ...overrides,
  };
}

function buildSeatRequest(
  overrides: Partial<B2BSeatRequestRow> = {},
): B2BSeatRequestRow {
  return {
    id: "seat-1",
    request_no: "SR-1",
    tour_id: "tour-1",
    travel_date: "2026-06-02",
    destination: "Seoul",
    requested_seats: 2,
    serial_group_id: "group-1",
    serial_index: 1,
    serial_total: 1,
    status: "approved_waiting_deposit",
    payment_state: "unpaid",
    deposit_due_at: null,
    next_deadline_at: null,
    created_at: "2026-05-18T00:00:00.000Z",
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<ComponentProps<typeof RecentAccessRequestsPanel>> = {},
) {
  const onExpand = vi.fn();
  const onContinueRequest = vi.fn();
  const onOpenAccessHistory = vi.fn();
  const onOpenPaymentPlan = vi.fn();

  const accessRequests = [buildAccessRequest()];
  const seatRequests = [buildSeatRequest()];

  render(
    <RecentAccessRequestsPanel
      recentAccessRequests={accessRequests}
      recentlySubmittedAccessRequestId=""
      expandedRecentAccessRequestId=""
      requests={seatRequests}
      isMongolianLanguage={false}
      tr={(en) => en}
      onExpand={onExpand}
      onContinueRequest={onContinueRequest}
      onOpenAccessHistory={onOpenAccessHistory}
      onOpenPaymentPlan={onOpenPaymentPlan}
      resolveAccessApprovalDeadline={() => "2026-05-21T00:00:00.000Z"}
      formatDateTime={(value, fallback = "-") => value || fallback}
      accessStatusClass={() => "bg-green-100"}
      accessStatusLabel={(status) => status}
      toRoleLabel={(role) => role}
      requestStatusClass={() => "bg-green-100"}
      requestStatusLabel={(request) => request.status}
      paymentStateLabel={(state) => state || "unpaid"}
      {...overrides}
    />,
  );

  return {
    onExpand,
    onContinueRequest,
    onOpenAccessHistory,
    onOpenPaymentPlan,
  };
}

describe("RecentAccessRequestsPanel", () => {
  it("calls onExpand when card header is clicked", () => {
    const { onExpand } = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /seoul/i }));

    expect(onExpand).toHaveBeenCalledWith("access-1");
  });

  it("routes approved request to selection callback", () => {
    const { onContinueRequest } = renderPanel({ expandedRecentAccessRequestId: "access-1" });

    fireEvent.click(screen.getByRole("button", { name: /continue with this request/i }));

    expect(onContinueRequest).toHaveBeenCalledWith("access-1");
  });

  it("opens payment callback when linked seat request exists", () => {
    const { onOpenPaymentPlan } = renderPanel({ expandedRecentAccessRequestId: "access-1" });

    fireEvent.click(screen.getByRole("button", { name: /open payment plan/i }));

    expect(onOpenPaymentPlan).toHaveBeenCalledWith("seat-1");
  });
});
