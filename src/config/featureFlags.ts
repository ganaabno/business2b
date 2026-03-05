const asBool = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

export const featureFlags = {
  b2bRoleV2Enabled: asBool(import.meta.env.VITE_B2B_ROLE_V2_ENABLED as string | undefined, false),
  b2bSeatRequestFlowEnabled: asBool(
    import.meta.env.VITE_B2B_SEAT_REQUEST_FLOW_ENABLED as string | undefined,
    false,
  ),
  b2bMonitoringEnabled: asBool(
    import.meta.env.VITE_B2B_MONITORING_ENABLED as string | undefined,
    false,
  ),
  b2bAdminTestModeEnabled: asBool(
    import.meta.env.VITE_B2B_ADMIN_TEST_MODE_ENABLED as string | undefined,
    false,
  ),
};
