const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function normalizeApiBase(rawValue: string | undefined) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return value.replace(/\/$/, "");
  }
}

function inferApiOriginFromLocation(location: Location) {
  const protocol = location.protocol === "http:" ? "http:" : "https:";
  const currentHost = location.hostname.toLowerCase();

  if (currentHost.startsWith("api.")) {
    return `${protocol}//${currentHost}`;
  }

  const hostWithoutWww = currentHost.startsWith("www.")
    ? currentHost.slice(4)
    : currentHost;

  return `${protocol}//api.${hostWithoutWww}`;
}

function shouldReplaceConfiguredBase(configuredBase: string, location: Location) {
  let parsed: URL;
  try {
    parsed = new URL(configuredBase);
  } catch {
    return false;
  }

  const configuredHost = parsed.hostname.toLowerCase();
  const currentHost = location.hostname.toLowerCase();

  const configuredNormalized = configuredHost.startsWith("www.")
    ? configuredHost.slice(4)
    : configuredHost;
  const currentNormalized = currentHost.startsWith("www.")
    ? currentHost.slice(4)
    : currentHost;

  const pointsToFrontendHost = configuredNormalized === currentNormalized;
  const pointsToApiHost = configuredHost.startsWith("api.");

  return pointsToFrontendHost && !pointsToApiHost;
}

function resolveApiBase() {
  const configuredBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

  if (typeof window === "undefined") {
    return configuredBase;
  }

  const runtimeHost = window.location.hostname.toLowerCase();
  const isLocalRuntime = LOCAL_HOSTNAMES.has(runtimeHost);

  if (isLocalRuntime) {
    return configuredBase;
  }

  const inferredBase = inferApiOriginFromLocation(window.location);

  if (!configuredBase) {
    return inferredBase;
  }

  if (shouldReplaceConfiguredBase(configuredBase, window.location)) {
    return inferredBase;
  }

  return configuredBase;
}

export const apiBaseUrl = resolveApiBase();
