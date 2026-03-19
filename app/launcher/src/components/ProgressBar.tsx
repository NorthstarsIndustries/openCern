import React from "react";
import { motion } from "framer-motion";

interface ProgressBarProps {
  percent?: number | null;
  label?: string;
  height?: number;
  className?: string;
}

export default function ProgressBar({
  percent,
  label,
  height = 4,
  className = "",
}: ProgressBarProps) {
  const isDeterminate = percent != null && percent >= 0;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {label}
          </span>
          {isDeterminate && (
            <span className="text-xs font-mono" style={{ color: "var(--color-text-tertiary)" }}>
              {Math.round(percent)}%
            </span>
          )}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full"
        style={{
          height,
          background: "var(--color-bg-surface)",
        }}
      >
        {isDeterminate ? (
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--color-accent)" }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, percent)}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ) : (
          <div className="h-full w-full relative overflow-hidden">
            <motion.div
              className="absolute h-full rounded-full"
              style={{
                width: "35%",
                background: "var(--color-accent)",
                opacity: 0.7,
              }}
              animate={{ x: ["-35%", "280%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
