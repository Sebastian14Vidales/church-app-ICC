import { ThinkingOrb } from "thinking-orbs";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({ label, className }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 ${className ?? ""}`}
    >
      <span className="sr-only">{label ?? "Cargando"}</span>
      <ThinkingOrb
        state="working"
        size={64}
        speed={1.4}
        theme="light"
        aria-label={label ?? "Cargando"}
      />
      {label && <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>}
    </div>
  );
}

export default LoadingSpinner;
