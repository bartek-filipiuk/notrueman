import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      // Browser-safe entries: exclude Node-only deps (BullMQ, fastify, etc.)
      "@nts/shared": path.resolve(__dirname, "../shared/src/browser.ts"),
      "@nts/agent-brain": path.resolve(__dirname, "../agent-brain/src/browser.ts"),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
