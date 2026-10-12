import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { lovableMcpPlugin } from "./scripts/lovableMcpPlugin";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), lovableMcpPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
