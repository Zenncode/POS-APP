import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5174,
    proxy: {
      // POS-API runs on :3001 here (:3000 is taken by another project).
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
