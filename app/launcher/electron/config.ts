import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface PortMapping {
  host: number;
  container: number;
}

export interface VolumeMapping {
  host_path: string;
  container_path: string;
  readonly: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface CustomContainerConfig {
  id: string;
  name: string;
  image: string;
  ports: PortMapping[];
  volumes: VolumeMapping[];
  env_vars: EnvVar[];
  join_network: boolean;
}

export interface LauncherConfig {
  setup_complete: boolean;
  docker_socket: string;
  update_interval_secs: number;
  auto_start: boolean;
  data_dir: string;
  custom_containers: CustomContainerConfig[];
}

function defaultConfig(): LauncherConfig {
  return {
    setup_complete: false,
    docker_socket: "",
    update_interval_secs: 360,
    auto_start: true,
    data_dir: path.join(os.homedir(), "opencern-datasets"),
    custom_containers: [],
  };
}

function configDir(): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "opencern");
  } else if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "opencern",
    );
  }
  return path.join(os.homedir(), ".config", "opencern");
}

function configPath(): string {
  return path.join(configDir(), "launcher.json");
}

/** Load config from disk, returning defaults if the file doesn't exist. */
export function loadConfig(): LauncherConfig {
  const p = configPath();
  if (fs.existsSync(p)) {
    try {
      const contents = fs.readFileSync(p, "utf-8");
      return { ...defaultConfig(), ...JSON.parse(contents) };
    } catch {
      return defaultConfig();
    }
  }
  return defaultConfig();
}

/** Save config to disk, creating parent directories if needed. */
export function saveConfig(config: LauncherConfig): void {
  const p = configPath();
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(config, null, 2));
}
