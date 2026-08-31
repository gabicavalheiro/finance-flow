// vite.config.ts
import { defineConfig } from "file:///sessions/zealous-vigilant-bell/mnt/financeatt/finance-flow/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/zealous-vigilant-bell/mnt/financeatt/finance-flow/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///sessions/zealous-vigilant-bell/mnt/financeatt/finance-flow/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "/sessions/zealous-vigilant-bell/mnt/financeatt/finance-flow";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core"
    ]
  },
  build: {
    // Capacitor precisa de caminhos relativos no build
    // "base: '/'" funciona pra web; pra app nativo, usar './'
    // A variável VITE_TARGET controla isso
    outDir: "dist",
    emptyOutDir: true
  },
  // base relativo para o app nativo funcionar com file:// protocol
  base: process.env.VITE_TARGET === "mobile" ? "./" : "/"
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvemVhbG91cy12aWdpbGFudC1iZWxsL21udC9maW5hbmNlYXR0L2ZpbmFuY2UtZmxvd1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3plYWxvdXMtdmlnaWxhbnQtYmVsbC9tbnQvZmluYW5jZWF0dC9maW5hbmNlLWZsb3cvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3plYWxvdXMtdmlnaWxhbnQtYmVsbC9tbnQvZmluYW5jZWF0dC9maW5hbmNlLWZsb3cvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xyXG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xyXG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIG92ZXJsYXk6IGZhbHNlLFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCldLmZpbHRlcihCb29sZWFuKSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSxcclxuICAgIH0sXHJcbiAgICBkZWR1cGU6IFtcclxuICAgICAgXCJyZWFjdFwiLFxyXG4gICAgICBcInJlYWN0LWRvbVwiLFxyXG4gICAgICBcInJlYWN0L2pzeC1ydW50aW1lXCIsXHJcbiAgICAgIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsXHJcbiAgICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIsXHJcbiAgICAgIFwiQHRhbnN0YWNrL3F1ZXJ5LWNvcmVcIixcclxuICAgIF0sXHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgLy8gQ2FwYWNpdG9yIHByZWNpc2EgZGUgY2FtaW5ob3MgcmVsYXRpdm9zIG5vIGJ1aWxkXHJcbiAgICAvLyBcImJhc2U6ICcvJ1wiIGZ1bmNpb25hIHByYSB3ZWI7IHByYSBhcHAgbmF0aXZvLCB1c2FyICcuLydcclxuICAgIC8vIEEgdmFyaVx1MDBFMXZlbCBWSVRFX1RBUkdFVCBjb250cm9sYSBpc3NvXHJcbiAgICBvdXREaXI6IFwiZGlzdFwiLFxyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgfSxcclxuICAvLyBiYXNlIHJlbGF0aXZvIHBhcmEgbyBhcHAgbmF0aXZvIGZ1bmNpb25hciBjb20gZmlsZTovLyBwcm90b2NvbFxyXG4gIGJhc2U6IHByb2Nlc3MuZW52LlZJVEVfVEFSR0VUID09PSBcIm1vYmlsZVwiID8gXCIuL1wiIDogXCIvXCIsXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFtVyxTQUFTLG9CQUFvQjtBQUNoWSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsdUJBQXVCO0FBSGhDLElBQU0sbUNBQW1DO0FBS3pDLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQUEsRUFDekMsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLElBQ1g7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLFNBQVMsaUJBQWlCLGdCQUFnQixDQUFDLEVBQUUsT0FBTyxPQUFPO0FBQUEsRUFDOUUsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTztBQUFBLElBQ3RDO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUlMLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQSxFQUNmO0FBQUE7QUFBQSxFQUVBLE1BQU0sUUFBUSxJQUFJLGdCQUFnQixXQUFXLE9BQU87QUFDdEQsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
