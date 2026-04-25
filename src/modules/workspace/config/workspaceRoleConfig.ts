export type WorkspaceRoleKind = "subcontractor" | "agent";

export type WorkspaceRoleContent = {
  interfaceLabel: string;
  kickerLabel: string;
  registerEnabledBadgeLabel: string;
  workflowLabel: string;
};

export function getWorkspaceRoleContent(
  role: WorkspaceRoleKind,
  useMongolian: boolean,
): WorkspaceRoleContent {
  if (role === "agent") {
    return {
      interfaceLabel: useMongolian ? "Агент интерфейс" : "Agent Interface",
      kickerLabel: useMongolian ? "Агентын ажлын орчин" : "Agent Workspace",
      registerEnabledBadgeLabel: useMongolian
        ? "Агент: Хүсэлт + Бүртгэл идэвхтэй"
        : "Agent: Requests + Register enabled",
      workflowLabel: useMongolian
        ? "Агентад зориулсан урсгал"
        : "Agent flow",
    };
  }

  return {
    interfaceLabel: useMongolian
      ? "Туслан гүйцэтгэгчийн интерфэйс"
      : "Subcontractor Interface",
    kickerLabel: useMongolian
      ? "Туслан гүйцэтгэгчийн ажлын хэсэг"
      : "Subcontractor Workspace",
    registerEnabledBadgeLabel: useMongolian
      ? "Хүсэлт + Бүртгэл идэвхтэй"
      : "Requests + Register enabled",
    workflowLabel: useMongolian
      ? "Туслан гүйцэтгэгчийн урсгал"
      : "Subcontractor flow",
  };
}
