import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Square,
  RotateCcw,
  Globe,
  Server,
  Cpu,
  Database,
  Radio,
  Atom,
  Box,
} from "lucide-react";
import GlassPanel from "./GlassPanel";
import StatusIndicator, { mapStateToStatus } from "./StatusIndicator";
import LogViewer from "./LogViewer";
import type { ContainerInfo, ContainerStats } from "../hooks/useDocker";

interface ContainerCardProps {
  container: ContainerInfo;
  onStart: (name: string) => Promise<void>;
  onStop: (name: string) => Promise<void>;
  onRestart: (name: string) => Promise<void>;
  getLogs: (name: string, lines: number) => Promise<string[]>;
  getStats: (name: string) => Promise<ContainerStats>;
}

const serviceIcons: Record<string, React.ReactNode> = {
  UI: <Globe size={18} />,
  API: <Server size={18} />,
  XRootD: <Database size={18} />,
  Streamer: <Radio size={18} />,
  Quantum: <Atom size={18} />,
};

export default function ContainerCard({
  container,
  onStart,
  onStop,
  onRestart,
  getLogs,
  getStats,
}: ContainerCardProps) {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const status = mapStateToStatus(container.state);
  const isRunning = status === "running";

  // Fetch stats periodically when running
  useEffect(() => {
    if (!isRunning) {
      setStats(null);
      return;
    }

    let cancelled = false;
    const fetchStats = async () => {
      try {
        const s = await getStats(container.name);
        if (!cancelled) setStats(s);
      } catch {
        // Container might have stopped
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isRunning, container.name, getStats]);

  const handleAction = useCallback(
    async (action: string, fn: (name: string) => Promise<void>) => {
      setActionLoading(action);
      try {
        await fn(container.name);
      } catch (err) {
        console.error(`${action} failed:`, err);
      } finally {
        setActionLoading(null);
      }
    },
    [container.name],
  );

  const icon = container.is_custom
    ? <Box size={18} />
    : serviceIcons[container.name] || <Server size={18} />;

  return (
    <GlassPanel hover className="relative overflow-hidden">
      {/* Top accent line when running */}
      {isRunning && (
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{
            background: "var(--color-status-running)",
            opacity: 0.3,
          }}
        />
      )}

      <div className="flex items-start justify-between gap-3">
        {/* Left: icon + info */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: isRunning
                ? "var(--color-status-running-muted)"
                : "var(--color-bg-surface)",
              color: isRunning
                ? "var(--color-status-running)"
                : "var(--color-text-tertiary)",
            }}
          >
            {icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className="text-sm font-semibold truncate"
                style={{ color: "var(--color-text-primary)" }}
              >
                {container.name}
              </h3>
              <StatusIndicator status={status} size={6} />
            </div>

            <p
              className="text-xs truncate mt-0.5"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {container.description || container.image}
            </p>

            {/* Ports */}
            {container.ports.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {container.ports.map((p, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--color-bg-surface)",
                      color: "var(--color-text-tertiary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                    }}
                  >
                    :{p.host}
                  </span>
                ))}
              </div>
            )}

            {/* Stats when running */}
            {isRunning && stats && (
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  <Cpu size={10} />
                  {stats.cpu_percent.toFixed(1)}%
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                  <Database size={10} />
                  {stats.memory_usage_mb.toFixed(0)}MB
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {isRunning ? (
            <>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction("restart", onRestart)}
                disabled={actionLoading !== null}
                className="btn-icon"
                aria-label="Restart"
                title="Restart"
              >
                <RotateCcw
                  size={14}
                  className={actionLoading === "restart" ? "animate-spin" : ""}
                />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction("stop", onStop)}
                disabled={actionLoading !== null}
                className="btn-icon"
                aria-label="Stop"
                title="Stop"
                style={{ color: "var(--color-status-stopped)" }}
              >
                <Square size={14} />
              </motion.button>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAction("start", onStart)}
              disabled={actionLoading !== null}
              className="btn-icon"
              aria-label="Start"
              title="Start"
              style={{ color: "var(--color-status-running)" }}
            >
              <Play size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Log viewer */}
      {isRunning && <LogViewer name={container.name} getLogs={getLogs} />}
    </GlassPanel>
  );
}
