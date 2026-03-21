import Docker from "dockerode";
import type { WebContents } from "electron";
import * as fs from "fs";
import { connect } from "./docker";
import type { CustomContainerConfig, PortMapping, VolumeMapping } from "./config";

const NETWORK_NAME = "opencern-net";
const GHCR_OWNER = "ceoatnorthstar";

export interface ServiceDef {
  name: string;
  image: string;
  container_name: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  description: string;
}

export function builtinServices(dataDir: string): ServiceDef[] {
  return [
    {
      name: "UI",
      image: `ghcr.io/${GHCR_OWNER}/ui:latest`,
      container_name: "opencern-ui",
      ports: [{ host: 3000, container: 3000 }],
      volumes: [],
      description: "Next.js web interface",
    },
    {
      name: "API",
      image: `ghcr.io/${GHCR_OWNER}/api:latest`,
      container_name: "opencern-api",
      ports: [{ host: 8080, container: 8080 }],
      volumes: [
        {
          host_path: dataDir,
          container_path: "/home/appuser/opencern-datasets",
          readonly: false,
        },
      ],
      description: "FastAPI backend with ROOT processing",
    },
    {
      name: "XRootD",
      image: `ghcr.io/${GHCR_OWNER}/xrootd:latest`,
      container_name: "opencern-xrootd",
      ports: [{ host: 8081, container: 8081 }],
      volumes: [
        {
          host_path: dataDir,
          container_path: "/home/appuser/opencern-datasets",
          readonly: false,
        },
      ],
      description: "CERN XRootD protocol proxy",
    },
    {
      name: "Streamer",
      image: `ghcr.io/${GHCR_OWNER}/streamer:latest`,
      container_name: "opencern-streamer",
      ports: [
        { host: 9001, container: 9001 },
        { host: 9002, container: 9002 },
      ],
      volumes: [
        {
          host_path: `${dataDir}/processed`,
          container_path: "/home/appuser/opencern-datasets/processed",
          readonly: true,
        },
      ],
      description: "Rust WebSocket event streamer",
    },
    {
      name: "Quantum",
      image: `ghcr.io/${GHCR_OWNER}/quantum:latest`,
      container_name: "opencern-quantum",
      ports: [{ host: 8082, container: 8082 }],
      volumes: [],
      description: "Qiskit quantum computing service",
    },
  ];
}

export interface ContainerInfo {
  name: string;
  container_name: string;
  image: string;
  status: string;
  state: string;
  ports: PortMapping[];
  description: string;
  is_custom: boolean;
}

export interface ContainerStats {
  cpu_percent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  memory_percent: number;
}

function resolveContainerName(name: string): string {
  const map: Record<string, string> = {
    UI: "opencern-ui",
    API: "opencern-api",
    XRootD: "opencern-xrootd",
    Streamer: "opencern-streamer",
    Quantum: "opencern-quantum",
  };
  return map[name] || name;
}

async function ensureNetwork(docker: Docker): Promise<void> {
  const networks = await docker.listNetworks();
  const exists = networks.some((n) => n.Name === NETWORK_NAME);
  if (!exists) {
    await docker.createNetwork({ Name: NETWORK_NAME, Driver: "bridge" });
  }
}

function ensureDataDirs(dataDir: string): void {
  const processed = `${dataDir}/processed`;
  fs.mkdirSync(processed, { recursive: true });
}

async function startService(docker: Docker, svc: ServiceDef): Promise<void> {
  // Remove existing container if present
  try {
    const existing = docker.getContainer(svc.container_name);
    await existing.remove({ force: true });
  } catch {}

  // Build port bindings and exposed ports
  const portBindings: Record<string, { HostIp: string; HostPort: string }[]> = {};
  const exposedPorts: Record<string, {}> = {};

  for (const pm of svc.ports) {
    const key = `${pm.container}/tcp`;
    exposedPorts[key] = {};
    portBindings[key] = [{ HostIp: "127.0.0.1", HostPort: String(pm.host) }];
  }

  // Build volume binds
  const binds = svc.volumes.map((v) =>
    v.readonly
      ? `${v.host_path}:${v.container_path}:ro`
      : `${v.host_path}:${v.container_path}`,
  );

  const container = await docker.createContainer({
    name: svc.container_name,
    Image: svc.image,
    ExposedPorts: exposedPorts,
    HostConfig: {
      PortBindings: portBindings,
      Binds: binds,
      NetworkMode: NETWORK_NAME,
      RestartPolicy: { Name: "unless-stopped" },
    },
  });

  await container.start();
}

/** List all managed containers (built-in + custom) with their current status. */
export async function listContainers(
  dockerSocket: string,
  dataDir: string,
  customContainers: CustomContainerConfig[],
): Promise<ContainerInfo[]> {
  const docker = await connect(dockerSocket);
  const allContainers = await docker.listContainers({ all: true });
  const services = builtinServices(dataDir);
  const results: ContainerInfo[] = [];

  // Match built-in services
  for (const svc of services) {
    const found = allContainers.find((c) =>
      c.Names?.some((n) => n.replace(/^\//, "") === svc.container_name),
    );

    if (found) {
      results.push({
        name: svc.name,
        container_name: svc.container_name,
        image: found.Image || svc.image,
        status: found.Status || "",
        state: found.State || "stopped",
        ports: svc.ports,
        description: svc.description,
        is_custom: false,
      });
    } else {
      results.push({
        name: svc.name,
        container_name: svc.container_name,
        image: svc.image,
        status: "Not created",
        state: "stopped",
        ports: svc.ports,
        description: svc.description,
        is_custom: false,
      });
    }
  }

  // Match custom containers
  for (const cc of customContainers) {
    const found = allContainers.find((c) =>
      c.Names?.some((n) => n.replace(/^\//, "") === cc.name),
    );

    if (found) {
      const ports: PortMapping[] = (found.Ports || [])
        .filter((p) => p.PublicPort)
        .map((p) => ({ host: p.PublicPort!, container: p.PrivatePort }));

      results.push({
        name: cc.name,
        container_name: cc.name,
        image: found.Image || cc.image,
        status: found.Status || "",
        state: found.State || "stopped",
        ports,
        description: `Custom: ${cc.image}`,
        is_custom: true,
      });
    } else {
      results.push({
        name: cc.name,
        container_name: cc.name,
        image: cc.image,
        status: "Not created",
        state: "stopped",
        ports: cc.ports,
        description: `Custom: ${cc.image}`,
        is_custom: true,
      });
    }
  }

  return results;
}

export async function startContainer(
  name: string,
  dockerSocket: string,
  dataDir: string,
): Promise<void> {
  const docker = await connect(dockerSocket);
  const services = builtinServices(dataDir);
  const svc = services.find((s) => s.name === name || s.container_name === name);
  if (!svc) throw new Error(`Unknown service: ${name}`);

  await ensureNetwork(docker);
  ensureDataDirs(dataDir);
  await startService(docker, svc);
}

export async function stopContainer(
  name: string,
  dockerSocket: string,
): Promise<void> {
  const docker = await connect(dockerSocket);
  const containerName = resolveContainerName(name);
  const container = docker.getContainer(containerName);
  await container.stop({ t: 10 });
}

export async function restartContainer(
  name: string,
  dockerSocket: string,
  dataDir: string,
): Promise<void> {
  const docker = await connect(dockerSocket);
  const containerName = resolveContainerName(name);

  try {
    const container = docker.getContainer(containerName);
    await container.restart({ t: 5 });
  } catch {
    // If restart failed, try full start
    await startContainer(name, dockerSocket, dataDir);
  }
}

export async function startAll(
  dockerSocket: string,
  dataDir: string,
): Promise<void> {
  const docker = await connect(dockerSocket);
  const services = builtinServices(dataDir);

  await ensureNetwork(docker);
  ensureDataDirs(dataDir);

  for (const svc of services) {
    await startService(docker, svc);
  }
}

export async function stopAll(
  dockerSocket: string,
  dataDir: string,
): Promise<void> {
  const docker = await connect(dockerSocket);
  const services = builtinServices(dataDir);

  for (const svc of services) {
    try {
      const container = docker.getContainer(svc.container_name);
      await container.stop({ t: 10 });
    } catch {}
  }
}

export async function getContainerLogs(
  name: string,
  dockerSocket: string,
  lines: number,
): Promise<string[]> {
  const docker = await connect(dockerSocket);
  const containerName = resolveContainerName(name);
  const container = docker.getContainer(containerName);

  const buffer = await container.logs({
    stdout: true,
    stderr: true,
    tail: lines,
  });

  // Docker log stream has 8-byte header per line; convert to string
  const output = buffer.toString("utf-8");
  return output
    .split("\n")
    .map((line) => {
      // Strip Docker log stream header (first 8 bytes per frame)
      if (line.length > 8) {
        const code = line.charCodeAt(0);
        if (code === 1 || code === 2) {
          return line.slice(8);
        }
      }
      return line;
    })
    .filter((line) => line.length > 0);
}

export async function getContainerStats(
  name: string,
  dockerSocket: string,
): Promise<ContainerStats> {
  const docker = await connect(dockerSocket);
  const containerName = resolveContainerName(name);
  const container = docker.getContainer(containerName);

  const stats = await container.stats({ stream: false });

  // Calculate CPU percent
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    (stats.cpu_stats.system_cpu_usage || 0) -
    (stats.precpu_stats.system_cpu_usage || 0);
  const numCpus = stats.cpu_stats.online_cpus || 1;

  const cpuPercent =
    systemDelta > 0 && cpuDelta >= 0
      ? (cpuDelta / systemDelta) * numCpus * 100
      : 0;

  const memUsage = stats.memory_stats.usage || 0;
  const memLimit = stats.memory_stats.limit || 1;

  return {
    cpu_percent: cpuPercent,
    memory_usage_mb: memUsage / 1_048_576,
    memory_limit_mb: memLimit / 1_048_576,
    memory_percent: (memUsage / memLimit) * 100,
  };
}

/** Pull Docker images with progress events emitted to the renderer. */
export async function pullImages(
  sender: WebContents,
  dockerSocket: string,
  imageNames: string[],
): Promise<void> {
  const docker = await connect(dockerSocket);
  const total = imageNames.length;

  for (let i = 0; i < imageNames.length; i++) {
    const image = imageNames[i];

    sender.send("pull-progress", {
      image,
      index: i,
      total,
      stage: "pulling",
      message: `Pulling ${image} (${i + 1}/${total})`,
      percent: Math.round((i / total) * 100),
    });

    try {
      const stream = await docker.pull(image);
      await new Promise<void>((resolve, reject) => {
        docker.modem.followProgress(
          stream,
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          },
          (event: { status?: string }) => {
            sender.send("pull-progress", {
              image,
              index: i,
              total,
              stage: "layer",
              message: event.status || "",
              percent: Math.round((i / total) * 100),
            });
          },
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sender.send("pull-progress", {
        image,
        index: i,
        total,
        stage: "error",
        message: `Error pulling ${image}: ${msg}`,
        percent: 0,
      });
      throw err;
    }

    sender.send("pull-progress", {
      image,
      index: i + 1,
      total,
      stage: "done",
      message: `Pulled ${image} (${i + 1}/${total})`,
      percent: Math.round(((i + 1) / total) * 100),
    });
  }
}

/** Check which images have updates available. */
export async function checkImageUpdates(
  dockerSocket: string,
  dataDir: string,
): Promise<string[]> {
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
}

/** Start a custom container. */
export async function startCustomContainer(
  config: CustomContainerConfig,
  dockerSocket: string,
): Promise<void> {
  const docker = await connect(dockerSocket);

  const svc: ServiceDef = {
    name: config.name,
    image: config.image,
    container_name: config.name,
    ports: config.ports,
    volumes: config.volumes,
    description: `Custom: ${config.image}`,
  };

  if (config.join_network) {
    await ensureNetwork(docker);
  }

  await startService(docker, svc);
}
