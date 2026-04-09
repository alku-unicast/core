import { useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { AlertCircle } from "lucide-react";

interface PINEntryProps {
  value: string;            // 4-char string, e.g. "12", "1234"
  onChange: (pin: string) => void;
  onSubmit: () => void;
  error: string | null;
  disabled?: boolean;
}

export function PINEntry({ value, onChange, onSubmit, error, disabled }: PINEntryProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Focus box at index
  const focusBox = (index: number) => {
    const el = inputRefs.current[Math.max(0, Math.min(3, index))];
    el?.focus();
    el?.select();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (value[index]) {
        // Clear current
        const arr = value.padEnd(4, " ").split("");
        arr[index] = " ";
        onChange(arr.join("").trimEnd());
      } else {
        // Move to previous
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
    const digit = rawValue.replace(/\D/g, "").slice(-1); // only last digit
    if (!digit) return;

    const arr = (value + "    ").slice(0, 4).split("");
    arr[index] = digit;
    const next = arr.join("").trimEnd();
    onChange(next);

    // Auto-submit when 4th digit entered
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

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-[var(--text-secondary)] text-center">
        Projektördeki <span className="font-semibold text-[var(--text-primary)]">4 haneli PIN</span>'i girin
      </p>

      {/* 4 digit boxes */}
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => {
          const char = value[i] ?? "";
          const isFilled = char.trim() !== "";
          const isFocused = false; // handled via CSS :focus

          return (
            <input
              key={i}
              id={`pin-box-${i}`}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={isFilled ? "•" : ""}
              disabled={disabled}
              onChange={(e) => handleInput(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={`
                w-14 h-16 text-center text-2xl font-bold font-mono rounded-xl border-2
                bg-[var(--bg-secondary)] text-[var(--text-primary)]
                outline-none transition-all duration-150
                ${
                  error
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

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--status-error)] animate-pulse">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
