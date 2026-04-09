import { Settings, Globe } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import logo from "../../assets/UniCast.png";

interface TopBarProps {
  onSettingsClick: () => void;
}

const FLAG: Record<string, string> = {
  tr: "🇹🇷",
  en: "🇬🇧",
};

export function TopBar({ onSettingsClick }: TopBarProps) {
  const { language, updateSettings } = useSettingsStore();

  const toggleLanguage = () => {
    updateSettings({ language: language === "tr" ? "en" : "tr" });
  };

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-[var(--accent-secondary)] shadow-md select-none">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <img src={logo} alt="UniCast" className="w-8 h-8 rounded-lg object-contain" />
        <div className="flex flex-col leading-tight">
          <span className="text-white font-semibold text-base tracking-wide">
            UniCast
          </span>
          <span className="text-[var(--accent)] text-[10px] font-medium uppercase tracking-widest opacity-80">
            Wireless Screen
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {/* Language Toggle */}
        <button
          id="btn-language-toggle"
          onClick={toggleLanguage}
          title={language === "tr" ? "Switch to English" : "Türkçeye geç"}
          className="
            flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
            text-white/80 hover:text-white hover:bg-white/10
            text-xs font-medium transition-colors duration-150
          "
        >
          <Globe size={14} />
          <span>{FLAG[language]}</span>
          <span className="uppercase">{language}</span>
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/20" />

        {/* Settings */}
        <button
          id="btn-open-settings"
          onClick={onSettingsClick}
          title="Settings"
          className="
            p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10
            transition-colors duration-150
          "
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
