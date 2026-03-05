import { q } from "../../db/transaction.js";
import type { AuthUser } from "../../shared/types/auth.js";

export async function getProfileOverviewService(user: AuthUser) {
  const [orgRes, activeReqRes, paymentRes, historyRes, bindingReqRes] = await Promise.all([
    q<{
      id: string;
      name: string;
      registration_number: string | null;
      merchant_code: string | null;
      contact_name: string | null;
      contact_phone: string | null;
      contact_email: string | null;
    }>(
      `
      select
        o.id::text,
        o.name,
        o.registration_number,
        o.merchant_code,
        o.contact_name,
        o.contact_phone,
        o.contact_email
      from public.organization_members om
      join public.organizations o on o.id = om.organization_id
      where om.user_id = $1::uuid
      order by om.is_primary desc
      limit 1
      `,
      [user.id],
    ),
    q<{
      id: string;
      request_no: string;
      destination: string;
      travel_date: string;
      requested_seats: number;
      status: string;
      created_at: string;
    }>(
      `
      select id::text, request_no, destination, travel_date, requested_seats, status::text, created_at
      from public.seat_requests
      where requester_user_id = $1::uuid
        and status in ('pending', 'approved_waiting_deposit', 'confirmed_deposit_paid')
      order by created_at desc
      `,
      [user.id],
    ),
    q<{
      id: string;
      seat_request_id: string;
      amount_mnt: number | string;
      payment_method: string;
      provider: string;
      status: string;
      paid_at: string | null;
      created_at: string;
    }>(
      `
      select
        p.id::text,
        p.seat_request_id::text,
        p.amount_mnt,
        p.payment_method,
        p.provider,
        p.status::text,
        p.paid_at,
        p.created_at
      from public.seat_request_payments p
      join public.seat_requests sr on sr.id = p.seat_request_id
      where sr.requester_user_id = $1::uuid
      order by p.created_at desc
      limit 100
      `,
      [user.id],
    ),
    q<{
      id: string;
      request_no: string;
      destination: string;
      travel_date: string;
      requested_seats: number;
      status: string;
      created_at: string;
    }>(
      `
      select id::text, request_no, destination, travel_date, requested_seats, status::text, created_at
      from public.seat_requests
      where requester_user_id = $1::uuid
      order by created_at desc
      limit 100
      `,
      [user.id],
    ),
    q<{
      id: string;
      merchant_code: string;
      requested_role: string;
      status: string;
      note: string | null;
      decision_reason: string | null;
      organization_name: string | null;
      created_at: string;
      reviewed_at: string | null;
    }>(
      `
      select
        br.id::text,
        br.merchant_code,
        br.requested_role::text,
        br.status::text,
        br.note,
        br.decision_reason,
        o.name as organization_name,
        br.created_at,
        br.reviewed_at
      from public.organization_binding_requests br
      left join public.organizations o on o.id = br.organization_id
      where br.user_id = $1::uuid
      order by br.created_at desc
      limit 20
      `,
      [user.id],
    ),
  ]);

  return {
    organization: orgRes.rows[0] || null,
    activeRequests: activeReqRes.rows,
    paymentHistory: paymentRes.rows,
    seatPurchaseHistory: historyRes.rows,
    bindingRequests: bindingReqRes.rows,
  };
}
