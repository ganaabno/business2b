import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const globalApiTarget =
    (env.VITE_GLOBAL_API_BASE_URL || "https://global-travel.mn").replace(
      /\/$/,
      "",
    );
  const localApiTarget =
    (env.VITE_LOCAL_API_TARGET || "http://localhost:8080").replace(/\/$/, "");

  return {
    plugins: [react(), tailwindcss()],
    base: "./",
    server: {
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
    },
  };
});
