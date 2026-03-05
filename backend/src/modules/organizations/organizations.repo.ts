import { q } from "../../db/transaction.js";

export async function createOrganizationRepo(params: {
  name: string;
  registrationNumber: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  createdBy: string;
}) {
  const { rows } = await q<{ id: string; merchant_code: string }>(
    `
    insert into public.organizations (
      name, registration_number, contact_name, contact_phone, contact_email, created_by
    )
    values ($1, $2, $3, $4, $5, $6::uuid)
    returning id::text, merchant_code
    `,
    [
      params.name,
      params.registrationNumber,
      params.contactName,
      params.contactPhone,
      params.contactEmail,
      params.createdBy,
    ],
  );
  return rows[0];
}

export async function addMemberRepo(params: {
  organizationId: string;
  userId: string;
  role: string;
  isPrimary: boolean;
}) {
  await q(
    `
    insert into public.organization_members (organization_id, user_id, app_role, is_primary)
    values ($1::uuid, $2::uuid, $3::public.app_role, $4)
    on conflict (organization_id, user_id)
    do update set app_role = excluded.app_role, is_primary = excluded.is_primary
    `,
    [params.organizationId, params.userId, params.role, params.isPrimary],
  );
}

export async function getOrganizationByIdRepo(id: string) {
  const { rows } = await q<{
    id: string;
    name: string;
    registration_number: string;
    merchant_code: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    members: unknown;
  }>(
    `
    select
      o.id::text,
      o.name,
      o.registration_number,
      o.merchant_code,
      o.contact_name,
      o.contact_phone,
      o.contact_email,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'userId', om.user_id::text,
            'role', om.app_role::text,
            'isPrimary', om.is_primary
          )
        ) filter (where om.id is not null),
        '[]'::jsonb
      ) as members
    from public.organizations o
    left join public.organization_members om on om.organization_id = o.id
    where o.id = $1::uuid
    group by o.id
    `,
    [id],
  );
  return rows[0] || null;
}

export async function getPrimaryOrganizationForUserRepo(userId: string) {
  const { rows } = await q<{ organization_id: string }>(
    `
    select organization_id::text
    from public.organization_members
    where user_id = $1::uuid
    order by is_primary desc, joined_at asc
    limit 1
    `,
    [userId],
  );
  return rows[0]?.organization_id || null;
}
