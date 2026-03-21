import Docker from "dockerode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";

/**
 * Auto-detect the Docker socket path and return a connected client.
 * Checks, in order: user-configured path, default unix socket, Colima,
 * Rancher Desktop, Podman, and finally the Windows named pipe.
 */
export async function connect(customSocket: string): Promise<Docker> {
  if (customSocket) {
    const docker = new Docker({ socketPath: customSocket });
    await docker.ping();
    return docker;
  }

  const home = os.homedir();
  const candidates = [
    "/var/run/docker.sock",
    path.join(home, ".colima/default/docker.sock"),
    path.join(home, ".rd/docker.sock"),
  ];

  // Add Podman socket on Linux
  if (process.platform === "linux") {
    try {
      const uid = process.getuid?.() ?? 1000;
      candidates.push(`/run/user/${uid}/podman/podman.sock`);
    } catch {}
  }

  for (const socketPath of candidates) {
    if (fs.existsSync(socketPath)) {
      try {
        const docker = new Docker({ socketPath });
        await docker.ping();
        return docker;
      } catch {
        continue;
      }
    }
  }

  // Windows: try named pipe
  if (process.platform === "win32") {
    try {
      const docker = new Docker({ socketPath: "//./pipe/docker_engine" });
      await docker.ping();
      return docker;
    } catch {}
  }

  // Last resort: default connection
  const docker = new Docker();
  await docker.ping();
  return docker;
}

/** Check if the Docker CLI binary is installed (available in PATH). */
export function isDockerInstalled(): boolean {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Check if the Docker daemon is running and responsive. */
export async function isDaemonRunning(customSocket: string): Promise<boolean> {
  try {
    await connect(customSocket);
    return true;
  } catch {
    return false;
  }
}
