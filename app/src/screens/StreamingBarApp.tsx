// Streaming bar window root — rendered in the second Tauri window
export function StreamingBarApp() {
  return (
    <div
      className="w-full h-full flex items-center px-3 rounded-2xl"
      style={{ background: "var(--bar-bg)", color: "var(--bar-text)" }}
      data-bar-theme="translucent-dark"
    >
      <span className="text-xs text-[var(--bar-text)] opacity-60">
        UniCast Stream Bar — Coming Soon
      </span>
    </div>
  );
}
