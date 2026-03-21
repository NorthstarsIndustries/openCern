import { cn } from "../lib/utils";

interface ProgressBarProps {
  percent?: number | null;
  label?: string;
  height?: number;
  className?: string;
}

export default function ProgressBar({
  percent,
  label,
  height = 3,
  className,
}: ProgressBarProps) {
  const isDeterminate = percent != null && percent >= 0;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-secondary">{label}</span>
          {isDeterminate && (
            <span className="text-xs text-text-tertiary font-mono">
              {Math.round(percent)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-bg-surface-hover"
        style={{ height }}
      >
        {isDeterminate ? (
          <div
            className="h-full rounded-full bg-text-primary transition-all duration-300"
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-text-tertiary animate-pulse"
            style={{ width: "40%" }}
          />
        )}
      </div>
    </div>
  );
}
