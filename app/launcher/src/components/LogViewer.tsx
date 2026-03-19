import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface LogViewerProps {
  name: string;
  getLogs: (name: string, lines: number) => Promise<string[]>;
}

export default function LogViewer({ name, getLogs }: LogViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    if (!expanded) return;
    setLoading(true);
    try {
      const result = await getLogs(name, 80);
      setLogs(result);
    } catch {
      setLogs(["Failed to fetch logs"]);
    } finally {
      setLoading(false);
    }
  }, [expanded, name, getLogs]);

  useEffect(() => {
    fetchLogs();
    if (!expanded) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [fetchLogs, expanded]);

  // Auto-scroll to bottom when logs update
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
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs w-full justify-center py-1 rounded-lg transition-colors"
        style={{ color: "var(--color-text-tertiary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-tertiary)")}
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "Hide Logs" : "View Logs"}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative mt-2">
              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 btn-icon z-10"
                aria-label="Copy logs"
                style={{ opacity: 0.6 }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>

              <div
                ref={scrollRef}
                className="rounded-lg p-3 overflow-y-auto"
                style={{
                  maxHeight: 160,
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  lineHeight: 1.6,
                  color: "var(--color-text-secondary)",
                }}
              >
                {loading && logs.length === 0 ? (
                  <span style={{ color: "var(--color-text-tertiary)" }}>Loading...</span>
                ) : logs.length === 0 ? (
                  <span style={{ color: "var(--color-text-tertiary)" }}>No logs available</span>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
