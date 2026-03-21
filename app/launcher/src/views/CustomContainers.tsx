import { useState, useCallback } from "react";
import { invoke } from "../lib/ipc";
import { Plus, Box } from "lucide-react";
import { Button } from "../components/ui/button";
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
        try { await onStop(name); } catch {}
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
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Custom Containers
          </h2>
          <p className="text-xs text-text-tertiary">
            Manage your own Docker containers
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus size={13} />
          Add
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {customContainers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Box size={28} className="mb-3 text-text-tertiary" />
            <p className="text-xs text-text-secondary">
              No custom containers
            </p>
            <p className="text-[10px] mt-1 text-text-tertiary">
              Add Docker containers to manage alongside OpenCERN services.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customContainers.map((c) => (
              <ContainerCard
                key={c.container_name}
                container={c}
                onStart={onStart}
                onStop={onStop}
                onRestart={onRestart}
                getLogs={getLogs}
                getStats={getStats}
                onDelete={() => handleDelete(c.name)}
                deleting={deleting === c.name}
              />
            ))}
          </div>
        )}
      </div>

      <AddContainerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdded={onRefresh}
      />
    </div>
  );
}
