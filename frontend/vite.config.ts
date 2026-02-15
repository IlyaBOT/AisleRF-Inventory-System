import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiBase = process.env.VITE_API_BASE || "http://localhost:8000/api";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiBase.replace(/\/api\s*$/, ""),
        changeOrigin: true
      },
      "/uploads": {
        target: apiBase.replace(/\/api\s*$/, ""),
        changeOrigin: true
      }
    }
  }
});
