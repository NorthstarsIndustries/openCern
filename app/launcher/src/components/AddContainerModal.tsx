import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface AddContainerModalProps {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}

interface PortRow {
  host: string;
  container: string;
}

interface VolumeRow {
  host_path: string;
  container_path: string;
  readonly: boolean;
}

interface EnvRow {
  key: string;
  value: string;
}

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
    setName("");
    setImage("");
    setPorts([{ host: "", container: "" }]);
    setVolumes([]);
    setEnvVars([]);
    setJoinNetwork(true);
    setError(null);
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
          ports: ports
            .filter((p) => p.host && p.container)
            .map((p) => ({ host: parseInt(p.host), container: parseInt(p.container) })),
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

  const inputStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 12,
    color: "var(--color-text-primary)",
    outline: "none",
    width: "100%",
    fontFamily: "var(--font-sans)",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="glass w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto"
            style={{ padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Add Custom Container
              </h2>
              <button onClick={onClose} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Container Name
                </label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-service"
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Docker Image
                </label>
                <input
                  style={inputStyle}
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="nginx:latest"
                />
              </div>

              {/* Ports */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    Port Mappings
                  </label>
                  <button
                    className="btn-icon"
                    onClick={() => setPorts([...ports, { host: "", container: "" }])}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {ports.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      style={{ ...inputStyle, width: "45%" }}
                      value={p.host}
                      onChange={(e) => {
                        const updated = [...ports];
                        updated[i].host = e.target.value;
                        setPorts(updated);
                      }}
                      placeholder="Host port"
                      type="number"
                    />
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>:</span>
                    <input
                      style={{ ...inputStyle, width: "45%" }}
                      value={p.container}
                      onChange={(e) => {
                        const updated = [...ports];
                        updated[i].container = e.target.value;
                        setPorts(updated);
                      }}
                      placeholder="Container port"
                      type="number"
                    />
                    {ports.length > 1 && (
                      <button
                        className="btn-icon shrink-0"
                        onClick={() => setPorts(ports.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Volumes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    Volume Mounts
                  </label>
                  <button
                    className="btn-icon"
                    onClick={() =>
                      setVolumes([...volumes, { host_path: "", container_path: "", readonly: false }])
                    }
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {volumes.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      style={{ ...inputStyle, width: "42%" }}
                      value={v.host_path}
                      onChange={(e) => {
                        const updated = [...volumes];
                        updated[i].host_path = e.target.value;
                        setVolumes(updated);
                      }}
                      placeholder="Host path"
                    />
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>:</span>
                    <input
                      style={{ ...inputStyle, width: "42%" }}
                      value={v.container_path}
                      onChange={(e) => {
                        const updated = [...volumes];
                        updated[i].container_path = e.target.value;
                        setVolumes(updated);
                      }}
                      placeholder="Container path"
                    />
                    <button
                      className="btn-icon shrink-0"
                      onClick={() => setVolumes(volumes.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Env vars */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    Environment Variables
                  </label>
                  <button
                    className="btn-icon"
                    onClick={() => setEnvVars([...envVars, { key: "", value: "" }])}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {envVars.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      style={{ ...inputStyle, width: "40%" }}
                      value={e.key}
                      onChange={(ev) => {
                        const updated = [...envVars];
                        updated[i].key = ev.target.value;
                        setEnvVars(updated);
                      }}
                      placeholder="KEY"
                    />
                    <span className="text-xs" style={{ color: "var(--color-text-tertiary)" }}>=</span>
                    <input
                      style={{ ...inputStyle, width: "50%" }}
                      value={e.value}
                      onChange={(ev) => {
                        const updated = [...envVars];
                        updated[i].value = ev.target.value;
                        setEnvVars(updated);
                      }}
                      placeholder="value"
                    />
                    <button
                      className="btn-icon shrink-0"
                      onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Network toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  Join OpenCERN network
                </label>
                <button
                  onClick={() => setJoinNetwork(!joinNetwork)}
                  className="w-10 h-5 rounded-full relative transition-colors duration-200"
                  style={{
                    background: joinNetwork ? "var(--color-accent)" : "rgba(255,255,255,0.1)",
                  }}
                >
                  <motion.div
                    className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                    animate={{ left: joinNetwork ? 22 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="text-xs p-2 rounded-lg"
                  style={{
                    background: "rgba(248, 113, 113, 0.1)",
                    color: "var(--color-status-stopped)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="btn-glass flex-1">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? "Adding..." : "Add Container"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
