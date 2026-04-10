import { Monitor, AppWindow, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StreamMode } from "../../types/stream";
import { WindowInfo, MonitorInfo } from "../../types/ipc";

interface StreamModeSelectorProps {
  mode: StreamMode;
  onModeChange: (mode: StreamMode) => void;

  monitors: MonitorInfo[];
  selectedMonitor: number;
  onMonitorChange: (index: number) => void;

  windows: WindowInfo[];
  selectedWindow: WindowInfo | null;
  onWindowChange: (w: WindowInfo) => void;
  onRefreshWindows: () => void;
  windowsLoading: boolean;
}

export function StreamModeSelector({
  mode,
  onModeChange,
  monitors,
  selectedMonitor,
  onMonitorChange,
  windows,
  selectedWindow,
  onWindowChange,
  onRefreshWindows,
  windowsLoading,
}: StreamModeSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        {t("connection.mode_title")}
      </span>

      {/* Mode radio buttons */}
      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          id="btn-mode-fullscreen"
          icon={<Monitor size={18} />}
          label={t("connection.mode_fullscreen")}
          description={t("connection.mode_fullscreen_desc")}
          selected={mode === "fullscreen"}
          onClick={() => onModeChange("fullscreen")}
        />
        <ModeButton
          id="btn-mode-window"
          icon={<AppWindow size={18} />}
          label={t("connection.mode_window")}
          description={t("connection.mode_window_desc")}
          selected={mode === "window"}
          onClick={() => onModeChange("window")}
        />
      </div>

      {/* Fullscreen: monitor select (only if multi-monitor) */}
      {mode === "fullscreen" && monitors.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-[var(--text-muted)]">{t("connection.display")}</label>
          <select
            id="select-monitor"
            value={selectedMonitor}
            onChange={(e) => onMonitorChange(Number(e.target.value))}
            className="
              w-full px-3 py-2 rounded-xl border border-[var(--border)]
              bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]
              focus:outline-none focus:border-[var(--accent)]
              transition-colors duration-150
            "
          >
            {monitors.map((m) => (
              <option key={m.index} value={m.index}>
                {m.name} {m.isPrimary ? `(${t("connection.primary")})` : ""} — {m.width}×{m.height}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Window mode: window dropdown */}
      {mode === "window" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--text-muted)]">{t("connection.select_window")}</label>
            <button
              id="btn-refresh-windows"
              onClick={onRefreshWindows}
              disabled={windowsLoading}
              className="flex items-center gap-1 text-xs text-[var(--accent)] hover:opacity-70 transition-opacity disabled:opacity-40"
            >
              <RefreshCw size={12} className={windowsLoading ? "animate-spin" : ""} />
              {t("connection.refresh")}
            </button>
          </div>

          {windows.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)]">
              {windowsLoading ? t("connection.loading_windows") : t("connection.no_windows")}
            </div>
          ) : (
            <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-none">
              {windows.map((w) => (
                <button
                  key={w.id}
                  id={`btn-window-${w.id}`}
                  onClick={() => onWindowChange(w)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm
                    border transition-all duration-150 truncate
                    ${
                      selectedWindow?.id === w.id
                        ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:border-[var(--border-hover)]"
                    }
                  `}
                >
                  <AppWindow size={14} className="shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate font-medium">{w.title}</span>
                  <span className="ml-auto text-xs text-[var(--text-muted)] shrink-0">
                    {w.processName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Internal mode button ──────────────────────────────────────────────────────

interface ModeButtonProps {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function ModeButton({ id, icon, label, description, selected, onClick }: ModeButtonProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 text-center
        transition-all duration-150
        ${
          selected
            ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
        }
      `}
    >
      {icon}
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="text-[10px] text-[var(--text-muted)] leading-tight">{description}</span>
    </button>
  );
}
