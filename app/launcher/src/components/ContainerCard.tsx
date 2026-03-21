import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  Globe,
  Server,
  Cpu,
  Database,
  Radio,
  Atom,
  Box,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
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
  onDelete?: () => void;
  deleting?: boolean;
}

const serviceIcons: Record<string, React.ReactNode> = {
  UI: <Globe size={15} />,
  API: <Server size={15} />,
  XRootD: <Database size={15} />,
  Streamer: <Radio size={15} />,
  Quantum: <Atom size={15} />,
};

export default function ContainerCard({
  container,
  onStart,
  onStop,
  onRestart,
  getLogs,
  getStats,
  onDelete,
  deleting = false,
}: ContainerCardProps) {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const status = mapStateToStatus(container.state);
  const isRunning = status === "running";

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
      } catch {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => { cancelled = true; clearInterval(interval); };
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
    ? <Box size={15} />
    : serviceIcons[container.name] || <Server size={15} />;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card
        hover
        className={isRunning ? "border-l-2 border-l-status-running" : "border-l-2 border-l-transparent"}
      >
        <CardHeader>
          {/* Expand toggle */}
          <CollapsibleTrigger asChild>
            <Button variant="icon" size="icon-sm">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </Button>
          </CollapsibleTrigger>

          {/* Icon */}
          <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${isRunning ? "text-status-running" : "text-text-tertiary"}`}>
            {icon}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold truncate text-text-primary">
                {container.name}
              </span>
              <StatusIndicator status={status} size={5} />
            </div>
            <p className="text-[10px] truncate mt-px text-text-tertiary font-mono">
              {container.image}
            </p>
          </div>

          {/* Ports */}
          {container.ports.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              {container.ports.map((p, i) => (
                <Badge key={i} variant="default">:{p.host}</Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          {isRunning && stats && (
            <div className="hidden sm:flex items-center gap-3">
              <span className="flex items-center gap-1 text-[10px] text-text-tertiary font-mono">
                <Cpu size={10} />
                {stats.cpu_percent.toFixed(1)}%
              </span>
              <span className="flex items-center gap-1 text-[10px] text-text-tertiary font-mono">
                {stats.memory_usage_mb.toFixed(0)}MB
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            {isRunning ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="icon"
                      size="icon-sm"
                      onClick={() => handleAction("restart", onRestart)}
                      disabled={actionLoading !== null}
                    >
                      <RotateCcw size={13} className={actionLoading === "restart" ? "animate-spin" : ""} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="icon"
                      size="icon-sm"
                      onClick={() => handleAction("stop", onStop)}
                      disabled={actionLoading !== null}
                      className="text-status-stopped"
                    >
                      <Square size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon-sm"
                    onClick={() => handleAction("start", onStart)}
                    disabled={actionLoading !== null}
                    className="text-status-running"
                  >
                    <Play size={13} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start</TooltipContent>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon-sm"
                    onClick={onDelete}
                    disabled={deleting || actionLoading !== null}
                    className="text-status-stopped opacity-60"
                  >
                    <Trash2 size={12} className={deleting ? "animate-spin" : ""} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>

        {/* Expanded detail area */}
        <CollapsibleContent>
          <CardContent>
            <div className="flex items-center gap-4 py-2 flex-wrap">
              {container.ports.length > 0 && (
                <div className="sm:hidden flex items-center gap-1.5">
                  {container.ports.map((p, i) => (
                    <Badge key={i} variant="default">:{p.host}</Badge>
                  ))}
                </div>
              )}
              <span className="text-[10px] text-text-tertiary">
                Status: {container.status}
              </span>
              {container.description && (
                <span className="text-[10px] text-text-tertiary">
                  {container.description}
                </span>
              )}
            </div>
            {isRunning && <LogViewer name={container.name} getLogs={getLogs} />}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
