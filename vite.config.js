import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite is our "build tool". In dev it serves files with instant
// hot-reload (save file -> browser updates in ~50ms, no refresh!).
// For production it bundles+minifies everything into a tiny dist/ folder.
export default defineConfig({
  plugins: [react()],
  // In dev, the browser calls /api on port 5173 and Vite forwards it to
  // Express on 3001 — so the app is same-origin and cookies just work.
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
