import { Settings, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import logo from "../../assets/UniCast.png";

interface TopBarProps {
  onSettingsClick: () => void;
}

export function TopBar({ onSettingsClick }: TopBarProps) {
  const { t } = useTranslation();
  const { language, appearance, updateSettings } = useSettingsStore();

  const toggleLanguage = () => {
    updateSettings({ language: language === "tr" ? "en" : "tr" });
  };

  const toggleTheme = () => {
    const next = appearance.mainTheme === "light" ? "dark" : "light";
    updateSettings({ appearance: { ...appearance, mainTheme: next } });
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <header className="flex items-center justify-between px-5 py-3 bg-[var(--accent-secondary)] shadow-md select-none">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <img src={logo} alt="UniCast" className="w-8 h-8 rounded-lg object-contain" />
        <span className="text-white font-semibold text-base tracking-wide">
          UniCast
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1">

        {/* Language — simple TR / EN text only */}
        <button
          id="btn-language-toggle"
          onClick={toggleLanguage}
          title={t("topbar.toggle_language")}
          className="
            px-2.5 py-1.5 rounded-lg
            text-white/80 hover:text-white hover:bg-white/10
            text-xs font-semibold uppercase tracking-wide
            transition-colors duration-150
          "
        >
          {language === "tr" ? "TR" : "EN"}
        </button>

        {/* Theme toggle — sun/moon icon */}
        <button
          id="btn-toggle-theme"
          onClick={toggleTheme}
          title={t("topbar.toggle_theme")}
          className="
            p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10
            transition-colors duration-150
          "
        >
          {appearance.mainTheme === "light"
            ? <Moon size={16} />
            : <Sun size={16} />
          }
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/20 mx-1" />

        {/* Settings */}
        <button
          id="btn-open-settings"
          onClick={onSettingsClick}
          title={t("topbar.settings")}
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
