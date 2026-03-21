import { BrowserWindow, app } from "electron";
import { autoUpdater } from "electron-updater";
import { loadConfig } from "./config";
import { builtinServices } from "./containers";
import { connect } from "./docker";

export interface LauncherUpdate {
  current_version: string;
  latest_version: string;
  download_url: string;
}

export interface UpdateStatus {
  image_updates: string[];
  launcher_update: LauncherUpdate | null;
}

// ── Auto-updater (electron-updater) ──────────────────────────────

function sendToAllWindows(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, data);
  }
}

export function initAutoUpdater(): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    sendToAllWindows("app-update-available", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendToAllWindows("app-update-progress", {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on("update-downloaded", () => {
    sendToAllWindows("app-update-ready", {});
  });

  autoUpdater.on("error", (err) => {
    sendToAllWindows("app-update-error", { message: err.message });
  });
}

export async function checkAppUpdate(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // Network error or no update — silently ignore
  }
}

export function downloadAppUpdate(): void {
  autoUpdater.downloadUpdate();
}

export function installAppUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}

// ── Docker image updates ──────────────────────────────────────────

async function checkDockerImageUpdates(
  dockerSocket: string,
  dataDir: string,
): Promise<string[]> {
  try {
    const docker = await connect(dockerSocket);
    const services = builtinServices(dataDir);
    const outdated: string[] = [];

    for (const svc of services) {
      try {
        const imageObj = docker.getImage(svc.image);
        const info = await imageObj.inspect();
        const localDigest =
          info.RepoDigests && info.RepoDigests.length > 0
            ? info.RepoDigests[0]
            : "";

        if (!localDigest) {
          outdated.push(svc.name);
        }
      } catch {
        outdated.push(svc.name);
      }
    }

    return outdated;
  } catch {
    return [];
  }
}

/** Spawn a background task that periodically checks for updates. */
export function spawnUpdateChecker(): void {
  initAutoUpdater();

  const check = async () => {
    const config = loadConfig();
    const imageUpdates = await checkDockerImageUpdates(
      config.docker_socket,
      config.data_dir,
    );

    // Check for app update via electron-updater
    await checkAppUpdate();

    if (imageUpdates.length > 0) {
      const status: UpdateStatus = {
        image_updates: imageUpdates,
        launcher_update: null,
      };
      sendToAllWindows("update-available", status);
    }

    const interval = loadConfig().update_interval_secs;
    setTimeout(check, interval * 1000);
  };

  // First check after 30 seconds
  setTimeout(check, 30_000);
}

/** Manually trigger an update check (called from frontend). */
export async function checkForUpdates(
  dockerSocket: string,
  dataDir: string,
): Promise<UpdateStatus> {
  const imageUpdates = await checkDockerImageUpdates(dockerSocket, dataDir);
  await checkAppUpdate();

  return {
    image_updates: imageUpdates,
    launcher_update: null,
  };
}
