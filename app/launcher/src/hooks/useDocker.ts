import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface PortMapping {
  host: number;
  container: number;
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

export interface CustomContainerConfig {
  id: string;
  name: string;
  image: string;
  ports: PortMapping[];
  volumes: { host_path: string; container_path: string; readonly: boolean }[];
  env_vars: { key: string; value: string }[];
  join_network: boolean;
}

interface DockerState {
  containers: ContainerInfo[];
  loading: boolean;
  error: string | null;
}

export function useDocker(dockerSocket: string, dataDir: string) {
  const [state, setState] = useState<DockerState>({
    containers: [],
    loading: true,
    error: null,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchContainers = useCallback(async () => {
    try {
      let customContainers: CustomContainerConfig[] = [];
      try {
        customContainers = await invoke<CustomContainerConfig[]>("list_custom_containers");
      } catch {
        // Config might not exist yet
      }

      const containers = await invoke<ContainerInfo[]>("list_containers", {
        dockerSocket: dockerSocket,
        dataDir: dataDir,
        customContainers: customContainers,
      });

      setState({ containers, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [dockerSocket, dataDir]);

  // Poll container status every 3 seconds
  useEffect(() => {
    fetchContainers();
    intervalRef.current = setInterval(fetchContainers, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchContainers]);

  const startContainer = useCallback(
    async (name: string) => {
      await invoke("start_container", {
        name,
        dockerSocket: dockerSocket,
        dataDir: dataDir,
      });
      await fetchContainers();
    },
    [dockerSocket, dataDir, fetchContainers],
  );

  const stopContainer = useCallback(
    async (name: string) => {
      await invoke("stop_container", {
        name,
        dockerSocket: dockerSocket,
      });
      await fetchContainers();
    },
    [dockerSocket, fetchContainers],
  );

  const restartContainer = useCallback(
    async (name: string) => {
      await invoke("restart_container", {
        name,
        dockerSocket: dockerSocket,
        dataDir: dataDir,
      });
      await fetchContainers();
    },
    [dockerSocket, dataDir, fetchContainers],
  );

  const startAll = useCallback(async () => {
    await invoke("start_all", {
      dockerSocket: dockerSocket,
      dataDir: dataDir,
    });
    await fetchContainers();
  }, [dockerSocket, dataDir, fetchContainers]);

  const stopAll = useCallback(async () => {
    await invoke("stop_all", {
      dockerSocket: dockerSocket,
      dataDir: dataDir,
    });
    await fetchContainers();
  }, [dockerSocket, dataDir, fetchContainers]);

  const openWebApp = useCallback(async () => {
    await invoke("open_webapp");
  }, []);

  const getLogs = useCallback(
    async (name: string, lines: number = 100): Promise<string[]> => {
      return invoke<string[]>("get_container_logs", {
        name,
        dockerSocket: dockerSocket,
        lines,
      });
    },
    [dockerSocket],
  );

  const getStats = useCallback(
    async (name: string): Promise<ContainerStats> => {
      return invoke<ContainerStats>("get_container_stats", {
        name,
        dockerSocket: dockerSocket,
      });
    },
    [dockerSocket],
  );

  return {
    ...state,
    refresh: fetchContainers,
    startContainer,
    stopContainer,
    restartContainer,
    startAll,
    stopAll,
    openWebApp,
    getLogs,
    getStats,
  };
}
