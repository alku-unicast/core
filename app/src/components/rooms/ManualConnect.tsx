import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Room } from "../../types/room";
import { Monitor, ArrowRight } from "lucide-react";

interface ManualConnectProps {
  onConnect: (room: Room) => void;
}

export function ManualConnect({ onConnect }: ManualConnectProps) {
  const { t } = useTranslation();
  const [ip, setIp] = useState("");

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ip) return;

    // Create a dummy room object for the connection
    const manualRoom: Room = {
      id: `manual-${ip}`,
      label: `${t("common.manual_connection", "Manual")}: ${ip}`,
      floor: "0",
      ip: ip,
      status: "idle",
      lastSeen: Date.now(),
    };

    onConnect(manualRoom);
  };

  return (
    <div className="mx-5 p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)]">
          <Monitor size={20} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t("discovery.manual_title", "Direct Connection")}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {t("discovery.manual_desc", "Enter the IP address of the projector to connect directly.")}
          </p>
        </div>
      </div>

      <form onSubmit={handleManualConnect} className="flex gap-2">
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="e.g. 192.168.1.15"
          className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          type="submit"
          disabled={!ip}
          className="bg-[var(--accent)] text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
        >
          {t("common.connect", "Connect")}
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
