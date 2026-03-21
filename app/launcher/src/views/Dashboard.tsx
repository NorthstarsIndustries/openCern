import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PlayCircle,
  StopCircle,
  RefreshCw,
  Bell,
  Download,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../components/ui/collapsible";
import { Tooltip, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import ContainerCard from "../components/ContainerCard";
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
  onCheckUpdates,
  onDismissUpdates,
  onPullUpdates,
  getLogs,
  getStats,
}: DashboardProps) {
  const builtIn = useMemo(() => containers.filter((c) => !c.is_custom), [containers]);
  const custom = useMemo(() => containers.filter((c) => c.is_custom), [containers]);
  const [servicesOpen, setServicesOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);

  const runningCount = containers.filter((c) => c.state === "running").length;
  const totalCount = containers.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Services</h2>
          <p className="text-xs text-text-tertiary">
            {runningCount} of {totalCount} running
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="icon" size="icon" onClick={onCheckUpdates}>
                <RefreshCw size={13} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Check for updates</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="sm" onClick={onStartAll}>
            <PlayCircle size={13} className="text-status-running" />
            Start All
          </Button>
          <Button variant="ghost" size="sm" onClick={onStopAll}>
            <StopCircle size={13} className="text-status-stopped" />
            Stop All
          </Button>
        </div>
      </div>

      {/* Update banner */}
      <AnimatePresence>
        {hasUpdates && updateStatus && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="mx-6 mt-3">
              <Card className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Bell size={13} className="text-text-secondary" />
                  <span className="text-xs text-text-secondary">
                    {updateStatus.image_updates.length > 0
                      ? `${updateStatus.image_updates.length} image update${updateStatus.image_updates.length > 1 ? "s" : ""} available`
                      : "Launcher update available"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={onPullUpdates} className="gap-1.5">
                    <Download size={11} /> Update
                  </Button>
                  <Button variant="icon" size="icon-sm" onClick={onDismissUpdates}>
                    <X size={13} />
                  </Button>
                </div>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Container list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && containers.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <Card className="p-5 text-center">
            <p className="text-xs text-status-stopped">{error}</p>
            <p className="text-xs mt-1 text-text-tertiary">
              Make sure Docker is running.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Built-in services */}
            {builtIn.length > 0 && (
              <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 mb-2 cursor-pointer">
                  {servicesOpen ? (
                    <ChevronDown size={12} className="text-text-tertiary" />
                  ) : (
                    <ChevronRight size={12} className="text-text-tertiary" />
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                    Core Services
                  </span>
                  <Badge variant="count">({builtIn.length})</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 gap-2">
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
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Custom containers */}
            {custom.length > 0 && (
              <Collapsible open={customOpen} onOpenChange={setCustomOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 mb-2 cursor-pointer">
                  {customOpen ? (
                    <ChevronDown size={12} className="text-text-tertiary" />
                  ) : (
                    <ChevronRight size={12} className="text-text-tertiary" />
                  )}
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
                    Custom
                  </span>
                  <Badge variant="count">({custom.length})</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 gap-2">
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
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
