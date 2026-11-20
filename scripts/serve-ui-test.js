/*
  Browser-test server.

  Starts the production build (API + built SPA) on a fixed port with a
  THROWAWAY SQLite database, so Playwright can click through real pages
  without ever touching server/data/placements.db. `npm run test:ui` builds
  first, then playwright.config.js launches this script as its webServer.
*/
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = process.env.UI_TEST_PORT || "3107";
const dbDir = mkdtempSync(join(tmpdir(), "vjti-ui-"));

process.env.DB_PATH = join(dbDir, "placements.db");
process.env.API_PORT = port;
process.env.JWT_SECRET = "ui-test-secret-key-that-is-at-least-32-chars";

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  rmSync(dbDir, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", () => rmSync(dbDir, { recursive: true, force: true }));

// Dynamic imports happen AFTER DB_PATH is set so db.js opens the temp file.
// seed-demo refuses to run in production, so seed first and let start.js
// switch the process into production mode for the server.
await import("../server/seed-demo.js");
await import("../server/start.js");
