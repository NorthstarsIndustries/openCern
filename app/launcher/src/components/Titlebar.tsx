import React from "react";
import { Minus, X } from "lucide-react";
import { invoke } from "../lib/ipc";
import { Button } from "./ui/button";

export default function Titlebar() {
  return (
    <div
      className="flex items-center justify-between h-10 px-4 select-none shrink-0 border-b border-border"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* macOS traffic lights space */}
      <div className="w-[70px]" />

      <div
        className="flex-1"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />

      {/* Window controls — only on Windows/Linux */}
      <div
        className="flex items-center gap-0.5 mac-hidden"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Button
          variant="icon"
          size="icon-sm"
          onClick={() => invoke("window:minimize")}
          aria-label="Minimize"
        >
          <Minus size={13} />
        </Button>
        <Button
          variant="icon"
          size="icon-sm"
          onClick={() => invoke("window:close")}
          aria-label="Close"
          className="hover:!text-red-400"
        >
          <X size={13} />
        </Button>
      </div>
    </div>
  );
}
