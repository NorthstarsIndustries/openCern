import * as docker from "./docker";
import { loadConfig, saveConfig } from "./config";
import { builtinServices } from "./containers";

export interface DockerStatus {
  installed: boolean;
  running: boolean;
}

/** Check whether Docker is installed and running. */
export async function checkDocker(dockerSocket: string): Promise<DockerStatus> {
  const installed = docker.isDockerInstalled();
  const running = installed ? await docker.isDaemonRunning(dockerSocket) : false;
  return { installed, running };
}

/** Get the Docker Desktop download URL for the current platform. */
export function getDockerInstallUrl(): string {
  switch (process.platform) {
    case "darwin":
      return "https://desktop.docker.com/mac/main/arm64/Docker.dmg";
    case "win32":
      return "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe";
    default:
      return "https://docs.docker.com/engine/install/";
  }
}

/** Check if first-time setup has been completed. */
export function getSetupStatus() {
  const config = loadConfig();
  return {
    complete: config.setup_complete,
    docker: {
      installed: docker.isDockerInstalled(),
      running: false,
    },
  };
}

/** Mark first-time setup as complete. */
export function completeSetup(): void {
  const config = loadConfig();
  config.setup_complete = true;
  saveConfig(config);
}

/** Get the list of images that need to be pulled for first-time setup. */
export function getSetupImages(dataDir: string): string[] {
  return builtinServices(dataDir).map((s) => s.image);
}
