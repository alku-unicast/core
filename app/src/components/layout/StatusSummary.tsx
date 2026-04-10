import { useTranslation } from "react-i18next";
import { useRoomStore } from "../../stores/roomStore";
import { useSettingsStore } from "../../stores/settingsStore";

export function StatusSummary() {
  const { t } = useTranslation();
  const { rooms, error } = useRoomStore();
  const { language } = useSettingsStore();

  const allRooms = Object.values(rooms);
  const onlineCount = allRooms.filter((r) => r.status !== "offline").length;
  const streamingCount = allRooms.filter((r) => r.status === "streaming").length;

  const locale = language === "tr" ? "tr-TR" : "en-US";
  const now = new Date().toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <footer className="flex items-center justify-between px-5 py-2.5 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <span>
          <span className="font-semibold text-[var(--status-idle)]">
            {onlineCount}
          </span>{" "}
          {t("status.online_count", { count: onlineCount }).split(" ").slice(1).join(" ")}
        </span>
        {streamingCount > 0 && (
          <>
            <span className="w-px h-3 bg-[var(--border)]" />
            <span>
              <span className="font-semibold text-[var(--status-streaming)]">
                {streamingCount}
              </span>{" "}
              {t("status.streaming_count", { count: streamingCount }).split(" ").slice(1).join(" ")}
            </span>
          </>
        )}
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        {error ? (
          <span className="text-[var(--status-error)]">{t("status.cached")}</span>
        ) : (
          <span>{t("status.last_update", { time: now })}</span>
        )}
      </div>
    </footer>
  );
}
