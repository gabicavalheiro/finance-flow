import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
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
    rollupOptions: {
      output: {
        // Separa bibliotecas pesadas do código do app: o navegador faz cache delas
        // e elas não precisam ser baixadas de novo a cada deploy.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(@firebase|firebase)\//.test(id)) return "vendor-firebase";
          if (/node_modules\/framer-motion\//.test(id)) return "vendor-motion";
          if (/node_modules\/@radix-ui\//.test(id)) return "vendor-radix";
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "vendor-react";
          return undefined;
        },
      },
    },
  },
  // base relativo para o app nativo funcionar com file:// protocol
  base: process.env.VITE_TARGET === "mobile" ? "./" : "/",
}));
