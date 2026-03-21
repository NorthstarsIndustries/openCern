import { BrowserWindow } from "electron";
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

const APP_VERSION = "1.0.0";

/** Check if any Docker images have newer versions available. */
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

/** Check GitHub Releases for a newer launcher version. */
async function checkLauncherVersion(): Promise<LauncherUpdate | null> {
  try {
    const resp = await fetch(
      "https://api.github.com/repos/NorthstarsIndustries/openCern/releases/latest",
      {
        headers: { "User-Agent": "opencern-launcher" },
      },
    );

    if (!resp.ok) return null;

    const release = (await resp.json()) as { tag_name?: string; html_url?: string };
    const tag = release.tag_name;
    if (!tag) return null;

    const latest = tag.replace(/^v/, "");

    // Simple semver comparison
    const currentParts = APP_VERSION.split(".").map(Number);
    const latestParts = latest.split(".").map(Number);

    let isNewer = false;
    for (let i = 0; i < 3; i++) {
      if ((latestParts[i] || 0) > (currentParts[i] || 0)) {
        isNewer = true;
        break;
      }
      if ((latestParts[i] || 0) < (currentParts[i] || 0)) break;
    }

    if (isNewer) {
      return {
        current_version: APP_VERSION,
        latest_version: latest,
        download_url: release.html_url || "",
      };
    }

    return null;
  } catch {
    return null;
  }
}

/** Spawn a background task that periodically checks for updates. */
export function spawnUpdateChecker(): void {
  const check = async () => {
    const config = loadConfig();
    const imageUpdates = await checkDockerImageUpdates(
      config.docker_socket,
      config.data_dir,
    );
    const launcherUpdate = await checkLauncherVersion();

    if (imageUpdates.length > 0 || launcherUpdate) {
      const status: UpdateStatus = {
        image_updates: imageUpdates,
        launcher_update: launcherUpdate,
      };

      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.webContents.send("update-available", status);
      }
    }

    // Schedule next check
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
  const launcherUpdate = await checkLauncherVersion();

  return {
    image_updates: imageUpdates,
    launcher_update: launcherUpdate,
  };
}
