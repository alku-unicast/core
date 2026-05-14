import { useRef, useEffect, useState, KeyboardEvent, ClipboardEvent } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { useTranslation, Trans } from "react-i18next";

interface PINEntryProps {
  value: string;            // 4-char string, e.g. "12", "1234"
  onChange: (pin: string) => void;
  onSubmit: () => void;
  error: string | null;
  disabled?: boolean;
  lockedUntil?: number | null;
}

export function PINEntry({ value, onChange, onSubmit, error, disabled, lockedUntil }: PINEntryProps) {
  const { t } = useTranslation();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [remainingSecs, setRemainingSecs] = useState(0);

  // ── Lockout countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockedUntil) {
      setRemainingSecs(0);
      return;
    }
    const tick = () => setRemainingSecs(Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = remainingSecs > 0;
  const isDisabled = disabled || isLocked;

  // ── Error Mapping ──────────────────────────────────────────────────────────

  const getLocalizedError = (msg: string | null): string | null => {
    if (!msg) return null;
    if (msg.includes("Wrong PIN") || msg.includes("Hatalı PIN")) {
      const remainingMatch = msg.match(/\d+/);
      const remaining = remainingMatch ? remainingMatch[0] : "0";
      return t("connection.errors.wrong_pin", { remaining });
    }
    if (msg.toLowerCase().includes("busy") || msg.includes("meşgul")) {
      return t("connection.errors.busy");
    }
    if (msg.toLowerCase().includes("timeout") || msg.includes("zaman aşımı")) {
      return t("connection.errors.timeout");
    }
    if (msg.toLowerCase().includes("connection error") || msg.includes("bağlantı hatası")) {
      return t("connection.errors.connection_error");
    }
    if (msg.toLowerCase().includes("unknown") || msg.includes("bilinmeyen")) {
      return t("connection.errors.unknown");
    }
    return msg; // Fallback to raw message
  };

  const localizedError = getLocalizedError(error);

  useEffect(() => {
    if (!isDisabled) {
      const timer = setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isDisabled]);

  const focusBox = (index: number) => {
    const el = inputRefs.current[Math.max(0, Math.min(3, index))];
    el?.focus();
    el?.select();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    // ── STRICT NUMERIC FILTER ──
    if (
      !/^[0-9]$/.test(e.key) &&
      !["Backspace", "ArrowLeft", "ArrowRight", "Enter", "Tab", "v", "c", "Delete"].includes(e.key) &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      e.preventDefault();
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        const arr = value.padEnd(4, " ").split("");
        arr[index] = " ";
        onChange(arr.join("").trimEnd());
      } else {
        if (index > 0) {
          const arr = value.padEnd(4, " ").split("");
          arr[index - 1] = " ";
          onChange(arr.join("").trimEnd());
          focusBox(index - 1);
        }
      }
    } else if (e.key === "ArrowLeft") {
      focusBox(index - 1);
    } else if (e.key === "ArrowRight") {
      focusBox(index + 1);
    } else if (e.key === "Enter" && value.length === 4) {
      onSubmit();
    }
  };

  const handleInput = (rawValue: string, index: number) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    if (!digit) return;

    const arr = (value + "    ").slice(0, 4).split("");
    arr[index] = digit;
    const next = arr.join("").trimEnd();
    onChange(next);

    if (index === 3) {
      setTimeout(() => onSubmit(), 50);
    } else {
      focusBox(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      onChange(pasted);
      focusBox(3);
      setTimeout(() => onSubmit(), 50);
    }
  };

  // Format remaining seconds as "4:30" or "0:45"
  const formatRemaining = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-[var(--text-secondary)] text-center">
        <Trans i18nKey="connection.pin_instruction">
          Projektördeki <span className="font-semibold text-[var(--text-primary)]">4 haneli PIN</span>'i girin
        </Trans>
      </p>

      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => {
          const char = value[i] ?? "";
          const isFilled = char.trim() !== "";

          return (
            <input
              key={i}
              id={`pin-box-${i}`}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={isFilled ? "•" : ""}
              disabled={isDisabled}
              autoFocus={i === 0}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => handleInput(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={`
                w-14 h-16 text-center text-2xl font-bold font-mono rounded-xl border-2
                bg-[var(--bg-secondary)] text-[var(--text-primary)]
                outline-none transition-all duration-150
                ${
                  isLocked
                    ? "border-amber-500/60 bg-amber-50/5 opacity-50"
                    : error
                    ? "border-[var(--status-error)] bg-red-50/10"
                    : isFilled
                    ? "border-[var(--accent)] shadow-[0_0_0_3px_var(--accent-subtle)]"
                    : "border-[var(--border)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-subtle)]"
                }
                disabled:opacity-40 disabled:cursor-not-allowed
              `}
              aria-label={`PIN digit ${i + 1}`}
            />
          );
        })}
      </div>

      {isLocked && (
        <div className="flex items-center gap-2 text-sm text-amber-500">
          <Lock size={14} />
          <span>{t("connection.pin_locked", { remaining: formatRemaining(remainingSecs) })}</span>
        </div>
      )}

      {!isLocked && localizedError && (
        <div className="flex items-center gap-2 text-sm text-[var(--status-error)] animate-pulse">
          <AlertCircle size={15} />
          <span>{localizedError}</span>
        </div>
      )}
    </div>
  );
}
