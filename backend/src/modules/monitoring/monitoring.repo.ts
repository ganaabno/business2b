import { q } from "../../db/transaction.js";

export type MonitoringRow = {
  id: string;
  request_no: string;
  requester_user_id: string;
  organization_id: string;
  organization_name: string;
  requester_role: string;
  tour_id: string;
  destination: string;
  travel_date: string;
  requested_seats: number;
  unit_price_mnt: number | string | null;
  total_price_mnt: number | string | null;
  status: string;
  deposit_due_at: string | null;
  created_at: string;
  updated_at: string | null;
  paid_total_mnt: number | string;
  next_deadline_at: string | null;
  current_payment_state: string | null;
  first_name: string | null;
  last_name: string | null;
  requester_username: string | null;
  email: string | null;
};

export async function listMonitoringRowsRepo(filters: {
  destination?: string;
  status?: string;
  organizationId?: string;
  paymentState?: string;
}) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.destination) {
    params.push(filters.destination);
    conditions.push(`mon.destination = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`mon.status::text = $${params.length}`);
  }
  if (filters.organizationId) {
    params.push(filters.organizationId);
    conditions.push(`mon.organization_id::text = $${params.length}`);
  }
  if (filters.paymentState) {
    params.push(filters.paymentState);
    conditions.push(`coalesce(mon.current_payment_state::text, 'unpaid') = $${params.length}`);
  }

  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await q<MonitoringRow>(
    `
    select
      mon.id::text,
      mon.request_no,
      mon.requester_user_id::text,
      mon.organization_id::text,
      mon.organization_name,
      mon.requester_role::text,
      mon.tour_id,
      mon.destination,
      mon.travel_date::text,
      mon.requested_seats,
      null::numeric as unit_price_mnt,
      null::numeric as total_price_mnt,
      mon.status::text,
      mon.deposit_due_at,
      mon.created_at,
      mon.created_at as updated_at,
      mon.paid_total_mnt,
      mon.next_deadline_at,
      mon.current_payment_state::text,
      coalesce(
        nullif(to_jsonb(requester) ->> 'first_name', ''),
        nullif(to_jsonb(requester) ->> 'firstname', '')
      ) as first_name,
      coalesce(
        nullif(to_jsonb(requester) ->> 'last_name', ''),
        nullif(to_jsonb(requester) ->> 'lastname', '')
      ) as last_name,
      coalesce(
        nullif(to_jsonb(requester) ->> 'username', ''),
        nullif(to_jsonb(requester) ->> 'user_name', ''),
        nullif(to_jsonb(requester) ->> 'name', '')
      ) as requester_username,
      coalesce(
        nullif(requester.email, ''),
        nullif(to_jsonb(requester) ->> 'email', '')
      ) as email
    from public.v_seat_request_monitoring mon
    left join lateral (
      select u.*
      from public.users u
      where u.id::text = mon.requester_user_id::text
         or coalesce(
           nullif(to_jsonb(u) ->> 'auth_user_id', ''),
           nullif(to_jsonb(u) ->> 'userid', '')
         ) = mon.requester_user_id::text
      limit 1
    ) requester on true
    ${where}
    order by mon.created_at desc
    limit 500
    `,
    params,
  );

  return rows;
}
