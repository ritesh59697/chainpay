import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Ports come from app/.env so the API and the screen share one config.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../app", "");
  if (!env.API_PORT || !env.UI_PORT) throw new Error("Set API_PORT and UI_PORT in app/.env");
  return {
    plugins: [react()],
    server: {
      port: Number(env.UI_PORT),
      strictPort: true,
      proxy: { "/api": `http://localhost:${env.API_PORT}` },
    },
  };
});
