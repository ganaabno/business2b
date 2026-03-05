import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { q } from "../../db/transaction.js";

export type BindingRequestStatus = "pending" | "approved" | "rejected";
export type BindingRequestedRole = "subcontractor" | "agent";

type OrganizationMerchantRow = {
  id: string;
  name: string;
  merchant_code: string;
};

export type BindingRequestRow = {
  id: string;
  user_id: string;
  organization_id: string | null;
  organization_name: string | null;
  merchant_code: string;
  requested_role: BindingRequestedRole;
  status: BindingRequestStatus;
  note: string | null;
  decision_reason: string | null;
  reviewed_by: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  requester_first_name: string | null;
  requester_last_name: string | null;
  requester_email: string | null;
};

export type BindingRequestForUpdate = {
  id: string;
  user_id: string;
  organization_id: string | null;
  merchant_code: string;
  requested_role: BindingRequestedRole;
  status: BindingRequestStatus;
};

const BASE_BINDING_REQUEST_SELECT = `
  select
    br.id::text,
    br.user_id::text,
    br.organization_id::text,
    o.name as organization_name,
    br.merchant_code,
    br.requested_role::text as requested_role,
    br.status::text as status,
    br.note,
    br.decision_reason,
    br.reviewed_by::text,
    reviewer.email as reviewed_by_email,
    br.reviewed_at,
    br.created_at,
    br.updated_at,
    requester.first_name as requester_first_name,
    requester.last_name as requester_last_name,
    requester.email as requester_email
  from public.organization_binding_requests br
  left join public.organizations o on o.id = br.organization_id
  left join public.users requester on requester.id = br.user_id
  left join public.users reviewer on reviewer.id = br.reviewed_by
`;

async function runQuery<T extends QueryResultRow>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
): Promise<QueryResult<T>> {
  if (client) {
    return client.query<T>(sql, params);
  }
  return q<T>(sql, params);
}

export async function findOrganizationByMerchantCodeRepo(merchantCode: string) {
  const { rows } = await q<OrganizationMerchantRow>(
    `
    select id::text, name, merchant_code
    from public.organizations
    where upper(merchant_code) = upper($1)
    limit 1
    `,
    [merchantCode],
  );

  return rows[0] || null;
}

export async function createBindingRequestRepo(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string | null;
    merchantCode: string;
    requestedRole: BindingRequestedRole;
    note: string | null;
  },
) {
  const { rows } = await client.query<{ id: string }>(
    `
    insert into public.organization_binding_requests (
      user_id,
      organization_id,
      merchant_code,
      requested_role,
      status,
      note
    )
    values ($1::uuid, $2::uuid, $3, $4::public.app_role, 'pending', $5)
    returning id::text
    `,
    [params.userId, params.organizationId, params.merchantCode, params.requestedRole, params.note],
  );

  return rows[0]?.id || null;
}

export async function listBindingRequestsRepo(
  filters: {
    userId?: string;
    status?: BindingRequestStatus;
    organizationId?: string;
    merchantCode?: string;
    limit?: number;
  },
  client?: PoolClient,
) {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`br.user_id = $${params.length}::uuid`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`br.status::text = $${params.length}`);
  }
  if (filters.organizationId) {
    params.push(filters.organizationId);
    conditions.push(`br.organization_id = $${params.length}::uuid`);
  }
  if (filters.merchantCode) {
    params.push(filters.merchantCode);
    conditions.push(`upper(br.merchant_code) = upper($${params.length})`);
  }

  const whereSql = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const limit = Math.max(1, Math.min(filters.limit ?? 200, 500));
  params.push(limit);

  const { rows } = await runQuery<BindingRequestRow>(
    `
    ${BASE_BINDING_REQUEST_SELECT}
    ${whereSql}
    order by br.created_at desc
    limit $${params.length}
    `,
    params,
    client,
  );

  return rows;
}

export async function getBindingRequestByIdRepo(id: string, client?: PoolClient) {
  const { rows } = await runQuery<BindingRequestRow>(
    `
    ${BASE_BINDING_REQUEST_SELECT}
    where br.id = $1::uuid
    limit 1
    `,
    [id],
    client,
  );

  return rows[0] || null;
}

export async function getBindingRequestByIdForUpdateRepo(client: PoolClient, id: string) {
  const { rows } = await client.query<BindingRequestForUpdate>(
    `
    select
      id::text,
      user_id::text,
      organization_id::text,
      merchant_code,
      requested_role::text as requested_role,
      status::text as status
    from public.organization_binding_requests
    where id = $1::uuid
    for update
    `,
    [id],
  );

  return rows[0] || null;
}

export async function approveBindingRequestRepo(
  client: PoolClient,
  params: {
    id: string;
    reviewedBy: string;
    decisionReason: string | null;
    organizationId: string;
  },
) {
  await client.query(
    `
    update public.organization_binding_requests
    set
      status = 'approved',
      organization_id = $2::uuid,
      reviewed_by = $3::uuid,
      reviewed_at = now(),
      decision_reason = $4,
      updated_at = now()
    where id = $1::uuid
    `,
    [params.id, params.organizationId, params.reviewedBy, params.decisionReason],
  );
}

export async function rejectBindingRequestRepo(
  client: PoolClient,
  params: {
    id: string;
    reviewedBy: string;
    decisionReason: string | null;
  },
) {
  await client.query(
    `
    update public.organization_binding_requests
    set
      status = 'rejected',
      reviewed_by = $2::uuid,
      reviewed_at = now(),
      decision_reason = $3,
      updated_at = now()
    where id = $1::uuid
    `,
    [params.id, params.reviewedBy, params.decisionReason],
  );
}

export async function assignPrimaryOrganizationMemberRepo(
  client: PoolClient,
  params: {
    userId: string;
    organizationId: string;
    role: BindingRequestedRole;
  },
) {
  await client.query(
    `
    update public.organization_members
    set is_primary = false
    where user_id = $1::uuid
      and is_primary = true
      and organization_id <> $2::uuid
    `,
    [params.userId, params.organizationId],
  );

  await client.query(
    `
    insert into public.organization_members (organization_id, user_id, app_role, is_primary)
    values ($1::uuid, $2::uuid, $3::public.app_role, true)
    on conflict (organization_id, user_id)
    do update
      set app_role = excluded.app_role,
          is_primary = true
    `,
    [params.organizationId, params.userId, params.role],
  );

  await client.query(
    `
    update public.users
    set role_v2 = $2::public.app_role
    where id = $1::uuid
    `,
    [params.userId, params.role],
  );
}
