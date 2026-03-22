import { createMemo } from "solid-js"
import { useTheme } from "../context/theme.js"

export function Progress(props: {
  label?: string
  percent: number
  width?: number
  mode?: "download" | "process" | "quantum"
}) {
  const { theme } = useTheme()

  const barWidth = () => props.width ?? 40
  const filled = createMemo(() => Math.round((props.percent / 100) * barWidth()))

  const barColor = () => {
    switch (props.mode) {
      case "quantum": return theme.accent
      case "process": return theme.info
      default: return theme.primary
    }
  }

  return (
    <box flexDirection="row" gap={1}>
      {props.label && <text fg={theme.text}>{props.label}</text>}
      <text fg={barColor()}>
        {"█".repeat(filled())}{"░".repeat(barWidth() - filled())}
      </text>
      <text fg={theme.textMuted}>{props.percent.toFixed(0)}%</text>
    </box>
  )
}
