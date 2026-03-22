import { createMemo, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { useRoute } from "../context/route.js"
import { TextAttributes } from "@opentui/core"

export function Header() {
  const { theme } = useTheme()
  const route = useRoute()

  const title = createMemo(() => {
    switch (route.data.type) {
      case "home": return "Home"
      case "session": return "AI Session"
      case "docker": return "Docker Services"
      case "quantum": return "Quantum Computing"
      case "datasets": return "Datasets"
      case "logs": return "Activity Log"
      default: return "OpenCERN"
    }
  })

  return (
    <box
      flexDirection="row"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      flexShrink={0}
      backgroundColor={theme.backgroundPanel}
    >
      <text fg={theme.primary} attributes={TextAttributes.BOLD}>
        OpenCERN
      </text>
      <text fg={theme.borderSubtle}> / </text>
      <text fg={theme.text}>{title()}</text>
      <box flexGrow={1} />
      <text fg={theme.textMuted}>v1.0.0-beta.1</text>
    </box>
  )
}
