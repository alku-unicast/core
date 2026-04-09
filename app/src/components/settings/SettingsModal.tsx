// SettingsModal stub — placeholder until full implementation
interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 shadow-2xl w-80 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">Ayarlar</h2>
        <p className="text-xs text-[var(--text-muted)]">Yakında...</p>
        <button
          onClick={onClose}
          className="mt-4 text-xs px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg"
        >
          Kapat
        </button>
      </div>
    </div>
  );
}
