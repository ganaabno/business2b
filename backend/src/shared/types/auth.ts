export type AppRole = "admin" | "manager" | "subcontractor" | "agent";

export type AuthUser = {
  id: string;
  role: AppRole;
  organizationId: string | null;
  actorId?: string;
  actorRole?: AppRole;
  isAdminTestMode?: boolean;
};
