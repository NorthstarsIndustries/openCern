import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ExternalLink,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Bell,
  Download,
} from "lucide-react";
import ContainerCard from "../components/ContainerCard";
import GlassPanel from "../components/GlassPanel";
import type { ContainerInfo } from "../hooks/useDocker";
import type { UpdateStatus } from "../hooks/useUpdater";

interface DashboardProps {
  containers: ContainerInfo[];
  loading: boolean;
  error: string | null;
  updateStatus: UpdateStatus | null;
  hasUpdates: boolean;
  onStart: (name: string) => Promise<void>;
  onStop: (name: string) => Promise<void>;
  onRestart: (name: string) => Promise<void>;
  onStartAll: () => Promise<void>;
  onStopAll: () => Promise<void>;
  onOpenWebApp: () => Promise<void>;
  onCheckUpdates: () => Promise<unknown>;
  onDismissUpdates: () => void;
  onPullUpdates: () => void;
  getLogs: (name: string, lines: number) => Promise<string[]>;
  getStats: (name: string) => Promise<import("../hooks/useDocker").ContainerStats>;
}

export default function Dashboard({
  containers,
  loading,
  error,
  updateStatus,
  hasUpdates,
  onStart,
  onStop,
  onRestart,
  onStartAll,
  onStopAll,
  onOpenWebApp,
  onCheckUpdates,
  onDismissUpdates,
  onPullUpdates,
  getLogs,
  getStats,
}: DashboardProps) {
  const builtIn = useMemo(
    () => containers.filter((c) => !c.is_custom),
    [containers],
  );
  const custom = useMemo(
    () => containers.filter((c) => c.is_custom),
    [containers],
  );

  const runningCount = containers.filter((c) => c.state === "running").length;
  const totalCount = containers.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Update Banner */}
      <AnimatePresence>
        {hasUpdates && updateStatus && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div
              className="mx-4 mt-2 p-3 rounded-xl flex items-center justify-between"
              style={{
                background: "var(--color-accent-muted)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <Bell size={14} style={{ color: "var(--color-accent)" }} />
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {updateStatus.image_updates.length > 0
                    ? `${updateStatus.image_updates.length} image update${updateStatus.image_updates.length > 1 ? "s" : ""} available`
                    : "Launcher update available"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={onPullUpdates} className="btn-glass text-xs flex items-center gap-1.5 py-1 px-3">
                  <Download size={12} /> Update
                </button>
                <button onClick={onDismissUpdates} className="btn-icon" style={{ color: "var(--color-text-tertiary)" }}>
                  &times;
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        {/* Open in Browser — hero button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenWebApp}
          className="w-full py-3.5 rounded-xl flex items-center justify-center gap-2.5 font-semibold text-sm"
          style={{
            background: "var(--color-accent)",
            color: "#ffffff",
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-accent)")}
        >
          <ExternalLink size={16} />
          Open in Browser
        </motion.button>

        {/* Status bar + master controls */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
              {runningCount}/{totalCount} running
            </span>
            <button onClick={onCheckUpdates} className="btn-icon" title="Check for updates">
              <RefreshCw size={12} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onStartAll}
              className="btn-glass text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <PlayCircle size={12} style={{ color: "var(--color-status-running)" }} />
              Start All
            </button>
            <button
              onClick={onStopAll}
              className="btn-glass text-xs flex items-center gap-1.5 py-1.5 px-3"
            >
              <StopCircle size={12} style={{ color: "var(--color-status-stopped)" }} />
              Stop All
            </button>
          </div>
        </div>
      </div>

      {/* Container list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {loading && containers.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw size={20} className="animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
          </div>
        ) : error ? (
          <GlassPanel className="text-center">
            <p className="text-xs" style={{ color: "var(--color-status-stopped)" }}>
              {error}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
              Make sure Docker is running.
            </p>
          </GlassPanel>
        ) : (
          <div className="space-y-2.5">
            {/* Section: Services */}
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider px-1 pt-1" style={{ color: "var(--color-text-tertiary)" }}>
                Services
              </h2>
              {builtIn.map((c) => (
                <ContainerCard
                  key={c.container_name}
                  container={c}
                  onStart={onStart}
                  onStop={onStop}
                  onRestart={onRestart}
                  getLogs={getLogs}
                  getStats={getStats}
                />
              ))}
            </div>

            {/* Section: Custom Containers */}
            {custom.length > 0 && (
              <div className="space-y-2 pt-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "var(--color-text-tertiary)" }}>
                  Custom
                </h2>
                {custom.map((c) => (
                  <ContainerCard
                    key={c.container_name}
                    container={c}
                    onStart={onStart}
                    onStop={onStop}
                    onRestart={onRestart}
                    getLogs={getLogs}
                    getStats={getStats}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
