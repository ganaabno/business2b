import { q } from "../../db/transaction.js";

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
    conditions.push(`destination = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status::text = $${params.length}`);
  }
  if (filters.organizationId) {
    params.push(filters.organizationId);
    conditions.push(`organization_id::text = $${params.length}`);
  }
  if (filters.paymentState) {
    params.push(filters.paymentState);
    conditions.push(`coalesce(current_payment_state::text, 'unpaid') = $${params.length}`);
  }

  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await q(
    `
    select *
    from public.v_seat_request_monitoring
    ${where}
    order by created_at desc
    limit 500
    `,
    params,
  );

  return rows;
}
