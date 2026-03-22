import { createMemo, For, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { useRoute, type Route } from "../context/route.js"
import { TextAttributes } from "@opentui/core"

interface SidebarItem {
  label: string
  icon: string
  route: Route
  badge?: number
}

export function Sidebar(props: {
  dockerCount?: number
  quantumJobs?: number
  datasetCount?: number
  width?: number
}) {
  const { theme } = useTheme()
  const route = useRoute()

  const items = createMemo((): SidebarItem[] => [
    {
      label: "Home",
      icon: "◉",
      route: { type: "home" },
    },
    {
      label: "Chat",
      icon: "◈",
      route: { type: "session" },
    },
    {
      label: "Docker",
      icon: "⊞",
      route: { type: "docker" },
      badge: props.dockerCount,
    },
    {
      label: "Quantum",
      icon: "⊛",
      route: { type: "quantum" },
      badge: props.quantumJobs,
    },
    {
      label: "Datasets",
      icon: "⊟",
      route: { type: "datasets" },
      badge: props.datasetCount,
    },
    {
      label: "Logs",
      icon: "⊙",
      route: { type: "logs" },
    },
  ])

  const width = () => props.width ?? 20

  return (
    <box
      flexDirection="column"
      width={width()}
      flexShrink={0}
      backgroundColor={theme.backgroundPanel}
    >
      {/* Branding */}
      <box paddingLeft={2} paddingTop={1} paddingBottom={2}>
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>
          OpenCERN
        </text>
      </box>

      {/* Navigation */}
      <For each={items()}>
        {(item) => {
          const isActive = createMemo(() => route.data.type === item.route.type)
          return (
            <box
              paddingLeft={2}
              paddingRight={1}
              backgroundColor={isActive() ? theme.backgroundElement : undefined}
              flexDirection="row"
              onMouseUp={() => route.navigate(item.route)}
            >
              <text fg={isActive() ? theme.primary : theme.textMuted}>
                {item.icon} {item.label}
              </text>
              <box flexGrow={1} />
              <Show when={item.badge != null && item.badge > 0}>
                <text fg={theme.textMuted}>{item.badge}</text>
              </Show>
            </box>
          )
        }}
      </For>

      {/* Spacer */}
      <box flexGrow={1} />

      {/* Bottom hints */}
      <box paddingLeft={2} paddingBottom={1} flexDirection="column">
        <text fg={theme.textMuted}>Tab navigate</text>
        <text fg={theme.textMuted}>Ctrl+C quit</text>
      </box>
    </box>
  )
}
