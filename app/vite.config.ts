import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port in dev mode
  server: {
    host: host || false,
    port: 5173,
    strictPort: true,
    hmr: host
      ? { protocol: "ws", host, port: 5183 }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Ensure relative paths work for Tauri's WebView
  base: "./",
  build: {
    target: ["es2021", "chrome105", "safari14"],
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
