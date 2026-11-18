import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  // Browser suites isolate dependency caches from the running local preview.
  cacheDir: process.env.CHRONICCARE_VITE_CACHE_DIR,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-ui": ["lucide-react", "sonner"],
        },
      },
    },
  },
});
