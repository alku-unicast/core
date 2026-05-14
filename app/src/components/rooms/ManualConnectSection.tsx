import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Network, ArrowRight, AlertCircle } from "lucide-react";
import { useConnectionStore } from "../../stores/connectionStore";
import { useNetworkStore } from "../../stores/networkStore";

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function isValidIp(ip: string): boolean {
  return IP_REGEX.test(ip) && ip.split(".").every((p) => parseInt(p, 10) <= 255);
}

export function ManualConnectSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { connect } = useConnectionStore();
  const { networkState } = useNetworkStore();

  const [ip, setIp] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (networkState !== "LOCAL_ONLY") return null;

  const valid = isValidIp(ip);

  const handleConnect = () => {
    if (!valid) {
      setError(t("network.invalid_ip"));
      return;
    }
    setError(null);
    connect({
      id: `manual-${ip}`,
      label: ip,
      floor: "",
      ip,
      status: "idle",
      lastSeen: 0,
    });
    navigate("/connect");
  };

  return (
    <div className="mx-4 mt-2 mb-4 px-4 py-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-2 mb-2 text-[var(--text-muted)]">
        <Network size={13} />
        <span className="text-xs font-medium">{t("network.manual_connect")}</span>
        {networkState === "LOCAL_ONLY" && (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            {t("network.offline_mode")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={ip}
          onChange={(e) => { setIp(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && valid && handleConnect()}
          placeholder={t("network.ip_placeholder")}
          className="
            flex-1 px-3 py-2 text-sm rounded-xl
            bg-[var(--bg-tertiary)] border border-[var(--border)]
            text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
            focus:outline-none focus:border-[var(--accent)]
            transition-colors duration-150
          "
        />
        <button
          onClick={handleConnect}
          disabled={!valid}
          className="
            flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
            bg-[var(--accent)] text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:bg-[var(--accent-hover)] active:scale-[0.97]
            transition-all duration-150
          "
        >
          {t("network.connect")}
          <ArrowRight size={14} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs">
          <AlertCircle size={11} />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-2 text-[10px] text-[var(--text-muted)]">
        {t("network.manual_hint")}
      </p>
    </div>
  );
}
