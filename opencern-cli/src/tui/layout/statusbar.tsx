import { Show } from "solid-js"
import { useTheme } from "../context/theme.js"

export function Statusbar(props: {
  dockerStatus?: string
  apiStatus?: string
  model?: string
}) {
  const { theme } = useTheme()

  return (
    <box
      flexDirection="row"
      paddingLeft={2}
      paddingRight={2}
      flexShrink={0}
      backgroundColor={theme.backgroundPanel}
      gap={2}
    >
      <Show when={props.dockerStatus}>
        <text fg={props.dockerStatus === "running" ? theme.success : theme.error}>
          {props.dockerStatus === "running" ? "●" : "○"} Docker
        </text>
      </Show>

      <Show when={props.apiStatus}>
        <text fg={props.apiStatus === "connected" ? theme.success : theme.warning}>
          {props.apiStatus === "connected" ? "●" : "○"} API
        </text>
      </Show>

      <Show when={props.model}>
        <text fg={theme.textMuted}>⊛ {props.model}</text>
      </Show>

      <box flexGrow={1} />

      <text fg={theme.textMuted}>Tab navigate  / commands  Esc back</text>
    </box>
  )
}
