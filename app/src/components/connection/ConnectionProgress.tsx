import { Tv, CheckCircle, Loader2 } from "lucide-react";
import { ConnectionPhase } from "../../types/stream";

interface ConnectionProgressProps {
  phase: ConnectionPhase;
}

const STEPS: { phase: ConnectionPhase; label: string }[] = [
  { phase: "waking",      label: "Pi Uyandırılıyor" },
  { phase: "hdmi_ready",  label: "HDMI Hazır" },
  { phase: "awaiting_pin", label: "PIN Bekleniyor" },
];

const PHASE_ORDER: ConnectionPhase[] = [
  "waking", "hdmi_ready", "awaiting_pin", "authenticating", "streaming"
];

function phaseIndex(phase: ConnectionPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function ConnectionProgress({ phase }: ConnectionProgressProps) {
  const currentIdx = phaseIndex(phase);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const stepIdx = phaseIndex(step.phase);
        const isDone    = currentIdx > stepIdx;
        const isActive  = currentIdx === stepIdx;

        return (
          <div key={step.phase} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center gap-1 w-28">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                  ${
                    isDone
                      ? "bg-[var(--status-idle)] text-white"
                      : isActive
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                  }
                `}
              >
                {isDone ? (
                  <CheckCircle size={16} />
                ) : isActive ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Tv size={14} />
                )}
              </div>
              <span
                className={`text-[10px] text-center leading-tight transition-colors duration-300 ${
                  isDone
                    ? "text-[var(--status-idle)]"
                    : isActive
                    ? "text-[var(--accent)] font-medium"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < STEPS.length - 1 && (
              <div
                className={`
                  h-0.5 w-10 mb-5 transition-all duration-500
                  ${currentIdx > stepIdx ? "bg-[var(--status-idle)]" : "bg-[var(--border)]"}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
