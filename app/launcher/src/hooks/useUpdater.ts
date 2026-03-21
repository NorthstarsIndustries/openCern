import { useState, useEffect, useCallback } from "react";
import { invoke, listen } from "../lib/ipc";

export interface LauncherUpdate {
  current_version: string;
  latest_version: string;
  download_url: string;
}

export interface UpdateStatus {
  image_updates: string[];
  launcher_update: LauncherUpdate | null;
}

export function useUpdater(dockerSocket: string, dataDir: string) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // Listen for background update events from the Electron main process
  useEffect(() => {
    const unlistenPromise = listen<UpdateStatus>("update-available", (event) => {
      setUpdateStatus(event.payload);
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const status = await invoke<UpdateStatus>("check_for_updates", {
        dockerSocket: dockerSocket,
        dataDir: dataDir,
      });
      setUpdateStatus(status);
      return status;
    } catch (err) {
      console.error("Update check failed:", err);
      return null;
    } finally {
      setChecking(false);
    }
  }, [dockerSocket, dataDir]);

  const hasUpdates =
    updateStatus != null &&
    (updateStatus.image_updates.length > 0 || updateStatus.launcher_update != null);

  const dismissUpdates = useCallback(() => {
    setUpdateStatus(null);
  }, []);

  return {
    updateStatus,
    checking,
    hasUpdates,
    checkForUpdates,
    dismissUpdates,
  };
}
