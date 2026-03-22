import { For, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { TextAttributes } from "@opentui/core"

export interface DatasetInfo {
  name: string
  size: string
  events?: number
  path: string
  downloaded: boolean
}

export function Datasets(props: {
  datasets: DatasetInfo[]
  isLoading: boolean
  onDownload?: (name: string) => void
  onOpen?: (name: string) => void
}) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      <box flexDirection="row" gap={2} flexShrink={0} paddingBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Datasets</text>
        <text fg={theme.textMuted}>{props.datasets.length} local</text>
      </box>

      <scrollbox flexGrow={1}>
        <box flexDirection="column" gap={1}>
          <Show when={props.isLoading}>
            <text fg={theme.textMuted}>Loading datasets...</text>
          </Show>

          <Show when={props.datasets.length === 0 && !props.isLoading}>
            <box flexDirection="column" gap={1}>
              <text fg={theme.textMuted}>No local datasets found.</text>
              <text fg={theme.textMuted}>Run /download to browse and download CERN Open Data.</text>
            </box>
          </Show>

          <For each={props.datasets}>
            {(dataset) => (
              <box
                flexDirection="row"
                gap={2}
                backgroundColor={theme.backgroundPanel}
                paddingLeft={2}
                paddingRight={1}
                onMouseUp={() => props.onOpen?.(dataset.name)}
              >
                <text fg={dataset.downloaded ? theme.success : theme.textMuted}>
                  {dataset.downloaded ? "●" : "○"}
                </text>
                <text fg={theme.text}>{dataset.name}</text>
                <text fg={theme.textMuted}>{dataset.size}</text>
                <Show when={dataset.events}>
                  <text fg={theme.info}>{dataset.events!.toLocaleString()} events</text>
                </Show>
                <box flexGrow={1} />
                <text fg={theme.textMuted}>{dataset.path}</text>
              </box>
            )}
          </For>
        </box>
      </scrollbox>

      <box flexDirection="row" gap={2} paddingTop={1} flexShrink={0}>
        <text fg={theme.textMuted}>/download  /search  /datasets  /stats &lt;file&gt;</text>
      </box>
    </box>
  )
}
