import { For, Show, createSignal } from "solid-js"
import { useTheme } from "../context/theme.js"
import { TextAttributes } from "@opentui/core"

export interface ContainerInfo {
  name: string
  image: string
  status: "running" | "stopped" | "error"
  ports?: string[]
  cpu?: string
  memory?: string
}

export function Docker(props: {
  containers: ContainerInfo[]
  isLoading: boolean
  onStartAll?: () => void
  onStopAll?: () => void
  onPull?: () => void
}) {
  const { theme } = useTheme()
  const [selected, setSelected] = createSignal(0)

  const statusColor = (status: string) => {
    switch (status) {
      case "running": return theme.success
      case "stopped": return theme.error
      case "error": return theme.error
      default: return theme.textMuted
    }
  }

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      {/* Header */}
      <box flexDirection="row" gap={2} flexShrink={0} paddingBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Docker Services
        </text>
        <text fg={theme.textMuted}>
          {props.containers.filter(c => c.status === "running").length}/{props.containers.length} running
        </text>
        <box flexGrow={1} />
        <Show when={props.onPull}>
          <box onMouseUp={props.onPull} backgroundColor={theme.backgroundElement} paddingLeft={1} paddingRight={1}>
            <text fg={theme.primary}>Pull Images</text>
          </box>
        </Show>
      </box>

      {/* Container list */}
      <scrollbox flexGrow={1}>
        <box flexDirection="column" gap={1}>
          <Show when={props.isLoading}>
            <text fg={theme.textMuted}>Loading containers...</text>
          </Show>

          <Show when={props.containers.length === 0 && !props.isLoading}>
            <text fg={theme.textMuted}>No containers found. Is Docker running?</text>
          </Show>

          <For each={props.containers}>
            {(container, i) => (
              <box
                flexDirection="column"
                backgroundColor={i() === selected() ? theme.backgroundElement : theme.backgroundPanel}
                paddingLeft={2}
                paddingRight={1}
                paddingTop={0}
                paddingBottom={0}
                border={container.status === "running" ? ["left"] : undefined}
                borderColor={container.status === "running" ? theme.success : undefined}
                onMouseUp={() => setSelected(i())}
              >
                <box flexDirection="row" gap={2}>
                  <text fg={statusColor(container.status)}>
                    {container.status === "running" ? "●" : "○"}
                  </text>
                  <text fg={theme.text} attributes={TextAttributes.BOLD}>
                    {container.name}
                  </text>
                  <text fg={theme.textMuted}>{container.image}</text>
                  <box flexGrow={1} />
                  <Show when={container.cpu}>
                    <text fg={theme.textMuted}>CPU {container.cpu}</text>
                  </Show>
                  <Show when={container.memory}>
                    <text fg={theme.textMuted}>MEM {container.memory}</text>
                  </Show>
                </box>
                <Show when={container.ports && container.ports.length > 0}>
                  <box paddingLeft={4}>
                    <text fg={theme.info}>
                      {container.ports!.join(", ")}
                    </text>
                  </box>
                </Show>
              </box>
            )}
          </For>
        </box>
      </scrollbox>

      {/* Actions bar */}
      <box flexDirection="row" gap={2} paddingTop={1} flexShrink={0}>
        <text fg={theme.textMuted}>Start All  Stop All  Pull Images</text>
      </box>
    </box>
  )
}
