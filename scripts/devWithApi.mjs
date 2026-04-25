import { spawn } from "node:child_process";

function detectPackageManager() {
  const userAgent = String(process.env.npm_config_user_agent || "").toLowerCase();

  if (userAgent.startsWith("pnpm/")) {
    return "pnpm";
  }

  if (userAgent.startsWith("yarn/")) {
    return "yarn";
  }

  return "npm";
}

function buildRunCommand(packageManager, scriptName) {
  if (packageManager === "yarn") {
    return `${packageManager} ${scriptName}`;
  }

  return `${packageManager} run ${scriptName}`;
}

function runScript(scriptName, envOverrides = {}) {
  const packageManager = detectPackageManager();
  const runCommand = buildRunCommand(packageManager, scriptName);
  const env = {
    ...process.env,
    ...envOverrides,
  };

  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", runCommand], {
          stdio: "inherit",
          env,
        })
      : spawn(packageManager, packageManager === "yarn" ? [scriptName] : ["run", scriptName], {
          stdio: "inherit",
          env,
        });

  child.on("error", (error) => {
    console.error(`[dev] Failed to start ${scriptName}:`, error);
  });

  return child;
}

function terminate(child) {
  if (!child || typeof child.pid !== "number") {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    killer.on("error", () => {
      child.kill("SIGTERM");
    });
    return;
  }

  child.kill("SIGTERM");
}

const shouldEnableJobsByDefault = ["1", "true", "yes", "on"].includes(
  String(process.env.EMAIL_NOTIFICATIONS_ENABLED || "false").toLowerCase(),
);

const apiProcess = runScript("api:dev", {
  NODE_ENV: "development",
  B2B_RUN_BACKGROUND_JOBS:
    process.env.B2B_RUN_BACKGROUND_JOBS ||
    (shouldEnableJobsByDefault ? "true" : "false"),
  GLOBAL_TOURS_SYNC_ENABLED: process.env.GLOBAL_TOURS_SYNC_ENABLED || "false",
  GLOBAL_TOURS_SYNC_ON_STARTUP:
    process.env.GLOBAL_TOURS_SYNC_ON_STARTUP || "false",
});

const forceViteProxy = !["0", "false", "no", "off"].includes(
  String(process.env.DEV_FORCE_VITE_PROXY || "true").toLowerCase(),
);

const webProcess = runScript(
  "dev:web",
  forceViteProxy
    ? {
        VITE_API_BASE_URL: "",
        VITE_LOCAL_API_TARGET:
          process.env.VITE_LOCAL_API_TARGET || "http://localhost:8080",
      }
    : {},
);

if (forceViteProxy) {
  console.log(
    "[dev] Using Vite /api proxy to local backend (set DEV_FORCE_VITE_PROXY=false to disable).",
  );
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  terminate(apiProcess);
  terminate(webProcess);

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
}

apiProcess.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`[dev] api:dev exited with code ${code ?? "unknown"}`);
    shutdown(typeof code === "number" ? code : 1);
  }
});

webProcess.on("exit", (code) => {
  if (!shuttingDown) {
    console.error(`[dev] dev:web exited with code ${code ?? "unknown"}`);
    shutdown(typeof code === "number" ? code : 1);
  }
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
