import { useState, useEffect, useRef, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

interface LogViewerProps {
  name: string;
  getLogs: (name: string, lines: number) => Promise<string[]>;
}

export default function LogViewer({ name, getLogs }: LogViewerProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLogs(name, 80);
      setLogs(result);
    } catch {
      setLogs(["Failed to fetch logs"]);
    } finally {
      setLoading(false);
    }
  }, [name, getLogs]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(logs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [logs]);

  return (
    <div className="relative mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-widest text-text-tertiary">
          Logs
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="icon" size="icon-sm" onClick={handleCopy}>
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{copied ? "Copied!" : "Copy logs"}</TooltipContent>
        </Tooltip>
      </div>
      <div
        ref={scrollRef}
        className="rounded-md p-3 overflow-y-auto max-h-[180px] bg-bg-base border border-border font-mono text-[10px] leading-[1.7] text-text-secondary"
      >
        {loading && logs.length === 0 ? (
          <span className="text-text-tertiary">Loading...</span>
        ) : logs.length === 0 ? (
          <span className="text-text-tertiary">No logs available</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
