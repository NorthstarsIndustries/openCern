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

export interface AppUpdateInfo {
  version: string;
  releaseNotes?: string;
}

export interface AppUpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export type AppUpdateState =
  | "idle"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export function useUpdater(dockerSocket: string, dataDir: string) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  // App auto-update state
  const [appUpdateState, setAppUpdateState] = useState<AppUpdateState>("idle");
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [appUpdateProgress, setAppUpdateProgress] =
    useState<AppUpdateProgress | null>(null);
  const [appUpdateError, setAppUpdateError] = useState<string | null>(null);

  // Listen for background update events from the Electron main process
  useEffect(() => {
    const unsubs: Promise<() => void>[] = [];

    unsubs.push(
      listen<UpdateStatus>("update-available", (event) => {
        setUpdateStatus(event.payload);
      }),
    );

    unsubs.push(
      listen<AppUpdateInfo>("app-update-available", (event) => {
        setAppUpdateState("available");
        setAppUpdateInfo(event.payload);
      }),
    );

    unsubs.push(
      listen<AppUpdateProgress>("app-update-progress", (event) => {
        setAppUpdateState("downloading");
        setAppUpdateProgress(event.payload);
      }),
    );

    unsubs.push(
      listen("app-update-ready", () => {
        setAppUpdateState("ready");
        setAppUpdateProgress(null);
      }),
    );

    unsubs.push(
      listen<{ message: string }>("app-update-error", (event) => {
        setAppUpdateState("error");
        setAppUpdateError(event.payload.message);
      }),
    );

    return () => {
      unsubs.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  const checkForUpdates = useCallback(async () => {
    setChecking(true);
    try {
      const status = await invoke<UpdateStatus>("check_for_updates", {
        dockerSocket,
        dataDir,
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

  const downloadUpdate = useCallback(async () => {
    setAppUpdateState("downloading");
    setAppUpdateProgress({ percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 });
    await invoke("download_app_update");
  }, []);

  const installUpdate = useCallback(async () => {
    await invoke("install_app_update");
  }, []);

  const hasUpdates =
    updateStatus != null &&
    (updateStatus.image_updates.length > 0 ||
      updateStatus.launcher_update != null);

  const dismissUpdates = useCallback(() => {
    setUpdateStatus(null);
  }, []);

  const dismissAppUpdate = useCallback(() => {
    setAppUpdateState("idle");
    setAppUpdateInfo(null);
    setAppUpdateProgress(null);
    setAppUpdateError(null);
  }, []);

  return {
    updateStatus,
    checking,
    hasUpdates,
    checkForUpdates,
    dismissUpdates,
    // App auto-update
    appUpdateState,
    appUpdateInfo,
    appUpdateProgress,
    appUpdateError,
    downloadUpdate,
    installUpdate,
    dismissAppUpdate,
  };
}
