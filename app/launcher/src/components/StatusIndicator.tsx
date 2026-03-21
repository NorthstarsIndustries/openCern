
type Status = "running" | "stopped" | "pulling" | "starting" | "error" | "unknown";

interface StatusIndicatorProps {
  status: Status;
  size?: number;
  showLabel?: boolean;
}

const statusConfig: Record<Status, { color: string; label: string }> = {
  running: { color: "bg-status-running", label: "Running" },
  stopped: { color: "bg-status-stopped", label: "Stopped" },
  pulling: { color: "bg-status-pending", label: "Pulling" },
  starting: { color: "bg-status-pending", label: "Starting" },
  error: { color: "bg-status-stopped", label: "Error" },
  unknown: { color: "bg-text-tertiary", label: "Unknown" },
};

const statusTextConfig: Record<Status, string> = {
  running: "text-status-running",
  stopped: "text-status-stopped",
  pulling: "text-status-pending",
  starting: "text-status-pending",
  error: "text-status-stopped",
  unknown: "text-text-tertiary",
};

export function mapStateToStatus(state: string): Status {
  switch (state.toLowerCase()) {
    case "running":
      return "running";
    case "exited":
    case "stopped":
    case "dead":
    case "not created":
      return "stopped";
    case "created":
    case "restarting":
      return "starting";
    default:
      return "unknown";
  }
}

export default function StatusIndicator({
  status,
  size = 6,
  showLabel = false,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const textClass = statusTextConfig[status];

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`rounded-full ${config.color}`}
        style={{ width: size, height: size }}
      />
      {showLabel && (
        <span className={`text-[10px] font-medium ${textClass}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}
