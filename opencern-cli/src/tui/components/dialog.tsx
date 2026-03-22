import { Show, type ParentProps } from "solid-js"
import { useTheme } from "../context/theme.js"
import { TextAttributes } from "@opentui/core"

export function Dialog(props: ParentProps<{
  title: string
  visible: boolean
  onClose?: () => void
  width?: number
  height?: number
}>) {
  const { theme } = useTheme()

  return (
    <Show when={props.visible}>
      <box
        position="absolute"
        top={2}
        left={10}
        width={props.width ?? 60}
        height={props.height}
        backgroundColor={theme.backgroundPanel}
        border={["top", "bottom", "left", "right"]}
        borderColor={theme.border}
        flexDirection="column"
        zIndex={100}
      >
        {/* Title bar */}
        <box
          flexDirection="row"
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={theme.backgroundElement}
          flexShrink={0}
        >
          <text fg={theme.text} attributes={TextAttributes.BOLD}>
            {props.title}
          </text>
          <box flexGrow={1} />
          <Show when={props.onClose}>
            <box onMouseUp={props.onClose}>
              <text fg={theme.textMuted}>✕</text>
            </box>
          </Show>
        </box>

        {/* Content */}
        <box flexGrow={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
          {props.children}
        </box>
      </box>
    </Show>
  )
}
