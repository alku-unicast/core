import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect, useRef } from "react";
import { RoomDiscovery } from "./screens/RoomDiscovery";
import { useSettingsStore } from "./stores/settingsStore";
import "./i18n"; // Initialize i18n
import i18n from "i18next";
import { useTranslation } from "react-i18next";

// Lazy-load heavy screens
import { lazy, Suspense } from "react";
const ConnectionSetup = lazy(() =>
  import("./screens/ConnectionSetup").then((m) => ({ default: m.ConnectionSetup }))
);
const StreamingBarApp = lazy(() =>
  import("./screens/StreamingBarApp").then((m) => ({ default: m.StreamingBarApp }))
);

// U2 — detect system theme on first load, and react to OS-level changes
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { appearance, language, updateSettings } = useSettingsStore();
  const initialised = useRef(false);

  // On first mount: if user has never explicitly chosen a theme (stored value
  // equals the hardcoded default "light"), snap to the OS preference instead.
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const systemTheme = mq.matches ? "dark" : "light";

    // Only override when the stored value is still the factory default ("light")
    // so that explicit user choice is never clobbered.
    if (appearance.mainTheme === "light" && systemTheme === "dark") {
      updateSettings({ appearance: { ...appearance, mainTheme: "dark" } });
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", appearance.mainTheme);
    }

    // Live: keep in sync if the user changes OS theme while app is open
    const handleChange = (e: MediaQueryListEvent) => {
      const next = e.matches ? "dark" : "light";
      updateSettings({ appearance: { ...appearance, mainTheme: next } });
      document.documentElement.setAttribute("data-theme", next);
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever appearance.mainTheme changes (user or OS), apply it
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appearance.mainTheme);
  }, [appearance.mainTheme]);

  // U1 — Keep i18n language in sync with settingsStore
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  // P10 — Disable right-click globally for production-ready feel
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // e.preventDefault(); // Temporarily disabled for debugging purposes
    };
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  return <>{children}</>;
}

function AppLoader({ children }: { children: React.ReactNode }) {
  const { loadFromDisk } = useSettingsStore();

  useEffect(() => {
    loadFromDisk();
  }, []);

  return <>{children}</>;
}

export default function App() {
  return (
    <HashRouter>
      <AppLoader>
        <ThemeProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<RoomDiscovery />} />
              <Route path="/connect" element={<ConnectionSetup />} />
              <Route path="/streaming-bar" element={<StreamingBarApp />} />
            </Routes>
          </Suspense>
        </ThemeProvider>
      </AppLoader>
    </HashRouter>
  );
}

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent)] animate-pulse" />
        <span className="text-sm text-[var(--text-muted)]">{t("common.loading_alt")}</span>
      </div>
    </div>
  );
}
