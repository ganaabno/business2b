import { forbidden } from "../../shared/http/errors.js";
import type { AuthUser } from "../../shared/types/auth.js";
import { listMonitoringRowsRepo } from "./monitoring.repo.js";

export async function listMonitoringRowsService(
  user: AuthUser,
  filters: { destination?: string; status?: string; organizationId?: string; paymentState?: string },
) {
  if (!(user.role === "admin" || user.role === "manager")) {
    throw forbidden("Monitoring is only available for admin/manager");
  }

  return listMonitoringRowsRepo(filters);
}
