import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, X } from "lucide-react";

interface TitlebarProps {
  title?: string;
}

export default function Titlebar({ title = "OpenCERN Launcher" }: TitlebarProps) {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-12 px-4 select-none shrink-0"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS traffic lights take this space — leave ~70px gap on the left */}
      <div className="w-[70px]" />

      <span
        data-tauri-drag-region
        className="text-xs font-medium tracking-wide"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {title}
      </span>

      {/* Window controls (visible on Windows/Linux, hidden on macOS via CSS) */}
      <div
        className="flex items-center gap-1 mac-hidden"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button onClick={handleMinimize} className="btn-icon" aria-label="Minimize">
          <Minus size={14} />
        </button>
        <button
          onClick={handleClose}
          className="btn-icon hover:!bg-red-500/20 hover:!text-red-400"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
