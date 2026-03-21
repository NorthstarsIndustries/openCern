import { useState, useCallback } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { Card } from "../components/ui/card";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../components/ui/select";
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Settings</h2>
          <p className="text-xs text-text-tertiary">
            Configure the OpenCERN Launcher
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw size={12} />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save size={12} />
            {saved ? "Saved" : saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="max-w-lg space-y-6">
          {/* Docker section */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">
              Docker
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5 text-text-secondary">
                  Socket Path
                </label>
                <Input
                  value={dockerSocket}
                  onChange={(e) => setDockerSocket(e.target.value)}
                  placeholder="Auto-detect (leave empty)"
                />
                <p className="text-[10px] mt-1 text-text-tertiary">
                  Leave empty to auto-detect Docker Desktop, Colima, or Podman.
                </p>
              </div>
              <div>
                <label className="block text-xs mb-1.5 text-text-secondary">
                  Data Directory
                </label>
                <Input
                  value={dataDir}
                  onChange={(e) => setDataDir(e.target.value)}
                  placeholder="~/opencern-datasets"
                />
              </div>
            </div>
          </section>

          {/* Updates section */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">
              Updates
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1.5 text-text-secondary">
                  Check Interval
                </label>
                <Select
                  value={String(updateInterval)}
                  onValueChange={(v) => setUpdateInterval(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="180">Every 3 minutes</SelectItem>
                    <SelectItem value="360">Every 6 minutes</SelectItem>
                    <SelectItem value="600">Every 10 minutes</SelectItem>
                    <SelectItem value="1800">Every 30 minutes</SelectItem>
                    <SelectItem value="3600">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-text-secondary">
                  Auto-start containers on launch
                </label>
                <Switch checked={autoStart} onCheckedChange={setAutoStart} />
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary mb-3">
              About
            </h3>
            <Card className="p-4">
              <p className="text-xs font-medium text-text-secondary">
                OpenCERN Launcher
              </p>
              <p className="text-[10px] mt-0.5 text-text-tertiary font-mono">
                v1.0.0
              </p>
              <p className="text-[10px] mt-2 text-text-tertiary">
                Docker-based service manager for the OpenCERN particle physics platform.
              </p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
