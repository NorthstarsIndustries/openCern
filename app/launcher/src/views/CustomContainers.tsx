import React, { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Box } from "lucide-react";
import { motion } from "framer-motion";
import GlassPanel from "../components/GlassPanel";
import ContainerCard from "../components/ContainerCard";
import AddContainerModal from "../components/AddContainerModal";
import type { ContainerInfo } from "../hooks/useDocker";

interface CustomContainersProps {
  containers: ContainerInfo[];
  onStart: (name: string) => Promise<void>;
  onStop: (name: string) => Promise<void>;
  onRestart: (name: string) => Promise<void>;
  getLogs: (name: string, lines: number) => Promise<string[]>;
  getStats: (name: string) => Promise<import("../hooks/useDocker").ContainerStats>;
  onRefresh: () => void;
}

export default function CustomContainers({
  containers,
  onStart,
  onStop,
  onRestart,
  getLogs,
  getStats,
  onRefresh,
}: CustomContainersProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const customContainers = containers.filter((c) => c.is_custom);

  const handleDelete = useCallback(
    async (name: string) => {
      setDeleting(name);
      try {
        // Stop the container first if running
        try {
          await onStop(name);
        } catch {
          // Might not be running
        }
        await invoke("remove_custom_container", { name });
        onRefresh();
      } catch (err) {
        console.error("Failed to remove container:", err);
      } finally {
        setDeleting(null);
      }
    },
    [onStop, onRefresh],
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Custom Containers
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-tertiary)" }}>
              Add and manage your own Docker containers
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setModalOpen(true)}
            className="btn-primary flex items-center gap-1.5 py-2 px-4 text-xs"
          >
            <Plus size={14} />
            Add
          </motion.button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {customContainers.length === 0 ? (
          <GlassPanel className="text-center py-12">
            <Box size={32} className="mx-auto mb-3" style={{ color: "var(--color-text-tertiary)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              No custom containers yet
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
              Add your own Docker containers to manage them alongside OpenCERN services.
            </p>
          </GlassPanel>
        ) : (
          <div className="space-y-2.5">
            {customContainers.map((c) => (
              <div key={c.container_name} className="relative">
                <ContainerCard
                  container={c}
                  onStart={onStart}
                  onStop={onStop}
                  onRestart={onRestart}
                  getLogs={getLogs}
                  getStats={getStats}
                />
                <button
                  onClick={() => handleDelete(c.name)}
                  disabled={deleting === c.name}
                  className="absolute top-3 right-12 btn-icon"
                  style={{ color: "var(--color-status-stopped)" }}
                  title="Remove container"
                >
                  <Trash2 size={12} className={deleting === c.name ? "animate-spin" : ""} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <AddContainerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={onRefresh}
      />
    </div>
  );
}
