import { HashRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { RoomDiscovery } from "./screens/RoomDiscovery";
import { useSettingsStore } from "./stores/settingsStore";

// Lazy-load heavy screens
import { lazy, Suspense } from "react";
const ConnectionSetup = lazy(() =>
  import("./screens/ConnectionSetup").then((m) => ({ default: m.ConnectionSetup }))
);
const StreamingBarApp = lazy(() =>
  import("./screens/StreamingBarApp").then((m) => ({ default: m.StreamingBarApp }))
);

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { appearance } = useSettingsStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appearance.mainTheme);
  }, [appearance.mainTheme]);

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
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent)] animate-pulse" />
        <span className="text-sm text-[var(--text-muted)]">Yükleniyor...</span>
      </div>
    </div>
  );
}
