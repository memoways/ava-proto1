import path from "path";
import { defineConfig } from "vite";

// Minimal config for vite-node: the app aliases and `.env` (public Lovable
// Cloud URL and publishable key), without the React and Lovable MCP plugins.
export default defineConfig({
  root: path.resolve(__dirname, "../.."),
  resolve: {
    alias: { "@": path.resolve(__dirname, "../../src") },
  },
});
