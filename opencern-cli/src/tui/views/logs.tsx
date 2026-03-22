import { For, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { TextAttributes } from "@opentui/core"

export interface ActivityEntry {
  timestamp: number
  type: "read" | "write" | "command" | "tool" | "info" | "error"
  message: string
  detail?: string
}

export function Logs(props: {
  entries: ActivityEntry[]
}) {
  const { theme } = useTheme()

  const typeColor = (type: ActivityEntry["type"]) => {
    switch (type) {
      case "read": return theme.info
      case "write": return theme.warning
      case "command": return theme.primary
      case "tool": return theme.accent
      case "info": return theme.textMuted
      case "error": return theme.error
    }
  }

  const typeIcon = (type: ActivityEntry["type"]) => {
    switch (type) {
      case "read": return "→"
      case "write": return "←"
      case "command": return ">"
      case "tool": return "⊛"
      case "info": return "·"
      case "error": return "✕"
    }
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
  }

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      <box flexDirection="row" gap={2} flexShrink={0} paddingBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>AI Activity Log</text>
        <text fg={theme.textMuted}>{props.entries.length} entries</text>
      </box>

      <scrollbox flexGrow={1}>
        <box flexDirection="column">
          <Show when={props.entries.length === 0}>
            <text fg={theme.textMuted}>No activity yet. Ask a question to get started.</text>
          </Show>

          <For each={props.entries}>
            {(entry) => (
              <box flexDirection="row" gap={1}>
                <text fg={theme.textMuted}>{formatTime(entry.timestamp)}</text>
                <text fg={typeColor(entry.type)}>{typeIcon(entry.type)}</text>
                <text fg={theme.text} wrapMode="word">{entry.message}</text>
                <Show when={entry.detail}>
                  <text fg={theme.textMuted}>{entry.detail}</text>
                </Show>
              </box>
            )}
          </For>
        </box>
      </scrollbox>
    </box>
  )
}
