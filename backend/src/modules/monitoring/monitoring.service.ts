import { forbidden } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { enrichRequesterIdentityRows } from "../auth/requesterIdentity.js";
import { listMonitoringRowsRepo } from "./monitoring.repo.js";

export async function listMonitoringRowsService(
  user: AuthUser,
  filters: { destination?: string; status?: string; organizationId?: string; paymentState?: string },
) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Monitoring is only available for admin/manager");
  }

  const rows = await listMonitoringRowsRepo(filters);
  const rowsForEnrichment = rows.map((row) => ({
    ...row,
    requester_first_name: row.first_name,
    requester_last_name: row.last_name,
    requester_email: row.email,
  }));

  const enriched = await enrichRequesterIdentityRows({
    rows: rowsForEnrichment,
    getRequesterAuthUserId: (row) => row.requester_user_id,
  });

  return enriched.map((row) => ({
    ...row,
    first_name: row.requester_first_name,
    last_name: row.requester_last_name,
    email: row.requester_email,
  }));
}
