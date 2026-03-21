import { useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import { invoke } from "../lib/ipc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

interface AddContainerModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

interface PortRow { host: string; container: string; }
interface VolumeRow { host_path: string; container_path: string; readonly: boolean; }
interface EnvRow { key: string; value: string; }

export default function AddContainerModal({ open, onClose, onAdded }: AddContainerModalProps) {
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [ports, setPorts] = useState<PortRow[]>([{ host: "", container: "" }]);
  const [volumes, setVolumes] = useState<VolumeRow[]>([]);
  const [envVars, setEnvVars] = useState<EnvRow[]>([]);
  const [joinNetwork, setJoinNetwork] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName(""); setImage("");
    setPorts([{ host: "", container: "" }]);
    setVolumes([]); setEnvVars([]);
    setJoinNetwork(true); setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !image.trim()) {
      setError("Name and image are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await invoke("add_custom_container", {
        container: {
          id: crypto.randomUUID(),
          name: name.trim(),
          image: image.trim(),
          ports: ports.filter((p) => p.host && p.container).map((p) => ({ host: parseInt(p.host), container: parseInt(p.container) })),
          volumes: volumes.filter((v) => v.host_path && v.container_path),
          env_vars: envVars.filter((e) => e.key),
          join_network: joinNetwork,
        },
      });
      reset();
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [name, image, ports, volumes, envVars, joinNetwork, reset, onAdded, onClose]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Container</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs mb-1.5 text-text-secondary">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-service" />
          </div>

          <div>
            <label className="block text-xs mb-1.5 text-text-secondary">Image</label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="nginx:latest" />
          </div>

          {/* Ports */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary">Ports</label>
              <Button variant="icon" size="icon-sm" onClick={() => setPorts([...ports, { host: "", container: "" }])}>
                <Plus size={12} />
              </Button>
            </div>
            {ports.map((p, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <Input className="w-[45%]" value={p.host} onChange={(e) => { const u = [...ports]; u[i].host = e.target.value; setPorts(u); }} placeholder="Host" type="number" />
                <span className="text-xs text-text-tertiary">:</span>
                <Input className="w-[45%]" value={p.container} onChange={(e) => { const u = [...ports]; u[i].container = e.target.value; setPorts(u); }} placeholder="Container" type="number" />
                {ports.length > 1 && (
                  <Button variant="icon" size="icon-sm" onClick={() => setPorts(ports.filter((_, j) => j !== i))}>
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Volumes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary">Volumes</label>
              <Button variant="icon" size="icon-sm" onClick={() => setVolumes([...volumes, { host_path: "", container_path: "", readonly: false }])}>
                <Plus size={12} />
              </Button>
            </div>
            {volumes.map((v, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <Input className="w-[42%]" value={v.host_path} onChange={(e) => { const u = [...volumes]; u[i].host_path = e.target.value; setVolumes(u); }} placeholder="Host path" />
                <span className="text-xs text-text-tertiary">:</span>
                <Input className="w-[42%]" value={v.container_path} onChange={(e) => { const u = [...volumes]; u[i].container_path = e.target.value; setVolumes(u); }} placeholder="Container path" />
                <Button variant="icon" size="icon-sm" onClick={() => setVolumes(volumes.filter((_, j) => j !== i))}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>

          {/* Env */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-text-secondary">Environment</label>
              <Button variant="icon" size="icon-sm" onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}>
                <Plus size={12} />
              </Button>
            </div>
            {envVars.map((e, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <Input className="w-[40%]" value={e.key} onChange={(ev) => { const u = [...envVars]; u[i].key = ev.target.value; setEnvVars(u); }} placeholder="KEY" />
                <span className="text-xs text-text-tertiary">=</span>
                <Input className="w-[50%]" value={e.value} onChange={(ev) => { const u = [...envVars]; u[i].value = ev.target.value; setEnvVars(u); }} placeholder="value" />
                <Button variant="icon" size="icon-sm" onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>

          {/* Network */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary">Join OpenCERN network</label>
            <Switch checked={joinNetwork} onCheckedChange={setJoinNetwork} />
          </div>

          {error && (
            <div className="text-xs p-2.5 rounded-md bg-status-stopped-muted text-status-stopped">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Adding..." : "Add Container"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
