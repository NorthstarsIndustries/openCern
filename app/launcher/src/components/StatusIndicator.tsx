import React from "react";
import { motion } from "framer-motion";

type Status = "running" | "stopped" | "pulling" | "starting" | "error" | "unknown";

interface StatusIndicatorProps {
  status: Status;
  size?: number;
  showLabel?: boolean;
}

const statusConfig: Record<Status, { color: string; label: string; animate: boolean }> = {
  running: {
    color: "var(--color-status-running)",
    label: "Running",
    animate: true,
  },
  stopped: {
    color: "var(--color-status-stopped)",
    label: "Stopped",
    animate: false,
  },
  pulling: {
    color: "var(--color-status-pending)",
    label: "Pulling",
    animate: true,
  },
  starting: {
    color: "var(--color-status-pending)",
    label: "Starting",
    animate: true,
  },
  error: {
    color: "var(--color-status-stopped)",
    label: "Error",
    animate: false,
  },
  unknown: {
    color: "var(--color-text-tertiary)",
    label: "Unknown",
    animate: false,
  },
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
  size = 8,
  showLabel = false,
}: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {config.animate && (
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full"
            style={{ background: config.color, opacity: 0.3 }}
          />
        )}
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: config.color }}
        />
      </div>
      {showLabel && (
        <span
          className="text-xs font-medium"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
      )}
    </div>
  );
}
