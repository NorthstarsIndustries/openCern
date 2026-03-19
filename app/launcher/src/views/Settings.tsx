import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Save, RotateCcw, FolderOpen, Info } from "lucide-react";
import GlassPanel from "../components/GlassPanel";
import type { Settings as SettingsType } from "../hooks/useSettings";

interface SettingsProps {
  settings: SettingsType;
  onSave: (updated: Partial<SettingsType>) => Promise<void>;
}

export default function Settings({ settings, onSave }: SettingsProps) {
  const [dockerSocket, setDockerSocket] = useState(settings.docker_socket);
  const [updateInterval, setUpdateInterval] = useState(settings.update_interval_secs);
  const [autoStart, setAutoStart] = useState(settings.auto_start);
  const [dataDir, setDataDir] = useState(settings.data_dir);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        docker_socket: dockerSocket,
        update_interval_secs: updateInterval,
        auto_start: autoStart,
        data_dir: dataDir,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  }, [dockerSocket, updateInterval, autoStart, dataDir, onSave]);

  const handleReset = useCallback(() => {
    setDockerSocket("");
    setUpdateInterval(360);
    setAutoStart(true);
    setDataDir(settings.data_dir || "");
  }, [settings.data_dir]);

  const inputStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: "var(--color-text-primary)",
    outline: "none",
    width: "100%",
    fontFamily: "var(--font-mono)",
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <h1 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Settings
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
          Configure the OpenCERN Launcher
        </p>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {/* Docker */}
        <GlassPanel>
          <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--color-text-secondary)" }}>
            Docker
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-tertiary)" }}>
                Socket Path
              </label>
              <input
                style={inputStyle}
                value={dockerSocket}
                onChange={(e) => setDockerSocket(e.target.value)}
                placeholder="Auto-detect (leave empty)"
              />
              <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}>
                Leave empty to auto-detect Docker Desktop, Colima, or Podman.
              </p>
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs mb-1.5" style={{ color: "var(--color-text-tertiary)" }}>
                <FolderOpen size={11} />
                Data Directory
              </label>
              <input
                style={inputStyle}
                value={dataDir}
                onChange={(e) => setDataDir(e.target.value)}
                placeholder="~/opencern-datasets"
              />
            </div>
          </div>
        </GlassPanel>

        {/* Updates */}
        <GlassPanel>
          <h3 className="text-xs font-semibold mb-3" style={{ color: "var(--color-text-secondary)" }}>
            Updates
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-tertiary)" }}>
                Check interval
              </label>
              <select
                value={updateInterval}
                onChange={(e) => setUpdateInterval(Number(e.target.value))}
                style={{
                  ...inputStyle,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  appearance: "none",
                }}
              >
                <option value={180}>Every 3 minutes</option>
                <option value={360}>Every 6 minutes</option>
                <option value={600}>Every 10 minutes</option>
                <option value={1800}>Every 30 minutes</option>
                <option value={3600}>Every hour</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                Auto-start containers on launch
              </label>
              <button
                onClick={() => setAutoStart(!autoStart)}
                className="w-10 h-5 rounded-full relative transition-colors duration-200"
                style={{
                  background: autoStart ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                }}
              >
                <motion.div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                  animate={{ left: autoStart ? 22 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </GlassPanel>

        {/* About */}
        <GlassPanel>
          <div className="flex items-start gap-2.5">
            <Info size={14} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-tertiary)" }} />
            <div>
              <h3 className="text-xs font-semibold" style={{ color: "var(--color-text-secondary)" }}>
                OpenCERN Launcher
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
                Version 1.0.0
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)", fontSize: 10 }}>
                Lightweight Docker-based service manager for the OpenCERN particle physics platform.
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button onClick={handleReset} className="btn-glass flex-1 flex items-center justify-center gap-1.5">
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5"
          >
            <Save size={12} />
            {saved ? "Saved!" : saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
