import { createSignal, onCleanup } from "solid-js"
import { docker } from "../../services/docker.js"
import type { ContainerInfo } from "../views/docker.js"

export function useDocker() {
  const [containers, setContainers] = createSignal<ContainerInfo[]>([])
  const [isRunning, setIsRunning] = createSignal(false)
  const [isLoading, setIsLoading] = createSignal(true)

  async function refresh() {
    try {
      const running = await docker.isDockerRunning()
      setIsRunning(running)

      if (!running) {
        setContainers([])
        setIsLoading(false)
        return
      }

      const status = docker.getStatus()
      const mapped: ContainerInfo[] = Object.entries(status).map(([name, info]) => ({
        name,
        image: name.replace("opencern-", "ghcr.io/ceoatnorthstar/") + ":latest",
        status: info.running ? "running" as const : "stopped" as const,
        ports: [],
      }))
      setContainers(mapped)
    } catch {
      setContainers([])
    } finally {
      setIsLoading(false)
    }
  }

  // Poll every 3 seconds
  const interval = setInterval(refresh, 3000)
  refresh()
  onCleanup(() => clearInterval(interval))

  return {
    containers,
    isRunning,
    isLoading,
    refresh,
    async startAll() {
      try {
        await docker.startContainers()
        await refresh()
      } catch {
        // swallow
      }
    },
    async stopAll() {
      try {
        await docker.stopContainers()
        await refresh()
      } catch {
        // swallow
      }
    },
  }
}
