import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendEntry = path.join(__dirname, "backend", "dist", "server.js");

if (!existsSync(backendEntry)) {
  console.error("Missing backend build artifact: backend/dist/server.js");
  console.error("Run: npm run api:build");
  process.exit(1);
}

await import("./backend/dist/server.js");
