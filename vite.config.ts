import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  build: {
    // Capacitor precisa de caminhos relativos no build
    // "base: '/'" funciona pra web; pra app nativo, usar './'
    // A variável VITE_TARGET controla isso
    outDir: "dist",
    emptyOutDir: true,
  },
  // base relativo para o app nativo funcionar com file:// protocol
  base: process.env.VITE_TARGET === "mobile" ? "./" : "/",
}));
