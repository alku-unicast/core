import { useTranslation } from "react-i18next";
import { Tv, CheckCircle, Loader2 } from "lucide-react";
import { ConnectionPhase } from "../../types/stream";

interface ConnectionProgressProps {
  phase: ConnectionPhase;
}

const PHASE_ORDER: ConnectionPhase[] = [
  "waking", "hdmi_ready", "awaiting_pin", "authenticating", "streaming"
];

function phaseIndex(phase: ConnectionPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function ConnectionProgress({ phase }: ConnectionProgressProps) {
  const { t } = useTranslation();
  const currentIdx = phaseIndex(phase);

  const steps: { phase: ConnectionPhase; label: string }[] = [
    { phase: "waking",      label: t("connection.waking").replace("...", "") },
    { phase: "hdmi_ready",  label: t("connection.hdmi_ready") },
    { phase: "awaiting_pin", label: t("connection.awaiting_pin") },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
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
            {i < steps.length - 1 && (
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
