import { useTranslation } from "react-i18next";
import { WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { useNetworkStore } from "../../stores/networkStore";
import { useRoomStore } from "../../stores/roomStore";

export function StatusBanner() {
  const { t } = useTranslation();
  const { networkState } = useNetworkStore();
  const { isRefreshing, lastCacheUpdate } = useRoomStore();

  const cacheAgeMin = lastCacheUpdate
    ? Math.floor((Date.now() - lastCacheUpdate) / 60000)
    : null;

  if (networkState === "ONLINE" && !isRefreshing) return null;
  if (networkState === "CHECKING" && !isRefreshing) return null;

  if (networkState === "NO_NETWORK") {
    return (
      <div className="mx-4 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs">
        <WifiOff size={13} className="shrink-0" />
        <span>{t("network.no_network")}</span>
      </div>
    );
  }

  if (networkState === "LOCAL_ONLY") {
    return (
      <div className="mx-4 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs">
        <AlertTriangle size={13} className="shrink-0" />
        <span>
          {t("network.local_only")}
          {cacheAgeMin !== null && cacheAgeMin > 0 && (
            <span className="opacity-70">
              {" "}({t("network.cache_age", { min: cacheAgeMin })})
            </span>
          )}
        </span>
      </div>
    );
  }

  // ONLINE + isRefreshing or CHECKING
  return (
    <div className="mx-4 mb-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-muted)] text-xs">
      <RefreshCw size={12} className="shrink-0 animate-spin" />
      <span>{t("network.refreshing")}</span>
    </div>
  );
}
