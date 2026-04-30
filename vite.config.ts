import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const globalApiTarget = (
    env.VITE_GLOBAL_API_BASE_URL || "https://global-travel.mn"
  ).replace(/\/$/, "");

  const localApiTarget = (
    env.VITE_LOCAL_API_TARGET || "http://localhost:8080"
  ).replace(/\/$/, "");

  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/__global_api": {
          target: globalApiTarget,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/__global_api/, ""),
        },
        "/api": {
          target: localApiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      outDir: "dist",
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("/src/components/OrdersTab.tsx") ||
              id.includes("/src/components/PassengerTab.tsx")
            ) {
              return "manager-ops";
            }

            if (
              id.includes("/src/api/") ||
              id.includes("/src/supabaseClient.ts")
            ) {
              return "app-data-layer";
            }

            if (id.includes("/src/i18n.ts")) {
              return "app-i18n";
            }

            if (
              id.includes("/src/components/AddPassengerTab.tsx") ||
              id.includes("/src/components/AddTourTab.tsx")
            ) {
              return "vendor-ui";
            }

            if (
              id.includes("/src/components/PassengerRequests.tsx") ||
              id.includes("/src/components/BlackList.tsx") ||
              id.includes("/src/components/InterestedLeadsTab.tsx") ||
              id.includes("/src/components/PassengersInLead.tsx")
            ) {
              return "manager-leads";
            }

            if (id.includes("/src/components/ProviderAssignmentsTab.tsx")) {
              return "manager-provider-assignments";
            }

            if (id.includes("/src/components/tasks/ManagerTasksTab.tsx")) {
              return "manager-tasks";
            }

            if (
              id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/react-router") ||
              id.includes("node_modules/scheduler") ||
              id.includes("node_modules/lucide-react") ||
              id.includes("node_modules/react-hot-toast") ||
              id.includes("node_modules/react-toastify") ||
              id.includes("node_modules/framer-motion")
            ) {
              return "vendor-ui";
            }

            if (id.includes("node_modules/@supabase")) {
              return "vendor-supabase";
            }

            if (
              id.includes("node_modules/chart.js") ||
              id.includes("node_modules/react-chartjs-2")
            ) {
              return "vendor-charts";
            }

            if (id.includes("node_modules/xlsx")) {
              return "vendor-xlsx";
            }

            if (id.includes("node_modules/papaparse")) {
              return "vendor-csv";
            }

            if (
              id.includes("node_modules/lucide-react") ||
              id.includes("node_modules/react-hot-toast") ||
              id.includes("node_modules/react-toastify") ||
              id.includes("node_modules/framer-motion")
            ) {
              return "vendor-ui";
            }
          },
        },
      },
    },
  };
});
