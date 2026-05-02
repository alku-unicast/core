import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { invoke } from "@tauri-apps/api/core";

// ── Frontend Log Bridge: send JS logs to Rust terminal ──────────────────
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  originalLog(...args);
  invoke("log_frontend", { level: "info", message: args.join(" ") }).catch(() => {});
};
console.warn = (...args) => {
  originalWarn(...args);
  invoke("log_frontend", { level: "warn", message: args.join(" ") }).catch(() => {});
};
console.error = (...args) => {
  originalError(...args);
  invoke("log_frontend", { level: "error", message: args.join(" ") }).catch(() => {});
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
