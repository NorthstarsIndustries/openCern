import { createSignal, For } from "solid-js"
import { useTheme } from "../context/theme.js"
import { useKeyboard } from "@opentui/solid"

export interface ListItem {
  label: string
  value: string
  description?: string
}

export function SelectList(props: {
  items: ListItem[]
  onSelect: (value: string) => void
  onCancel?: () => void
}) {
  const { theme } = useTheme()
  const [selected, setSelected] = createSignal(0)

  useKeyboard((evt) => {
    if (evt.name === "up") {
      setSelected(s => Math.max(0, s - 1))
      evt.preventDefault()
    }
    if (evt.name === "down") {
      setSelected(s => Math.min(props.items.length - 1, s + 1))
      evt.preventDefault()
    }
    if (evt.name === "return") {
      const item = props.items[selected()]
      if (item) props.onSelect(item.value)
      evt.preventDefault()
    }
    if (evt.name === "escape" && props.onCancel) {
      props.onCancel()
      evt.preventDefault()
    }
  })

  return (
    <box flexDirection="column">
      <For each={props.items}>
        {(item, i) => (
          <box
            flexDirection="row"
            gap={1}
            backgroundColor={i() === selected() ? theme.backgroundElement : undefined}
            paddingLeft={1}
            onMouseUp={() => props.onSelect(item.value)}
            onMouseOver={() => setSelected(i())}
          >
            <text fg={i() === selected() ? theme.primary : theme.text}>
              {i() === selected() ? "❯" : " "} {item.label}
            </text>
            {item.description && (
              <text fg={theme.textMuted}>{item.description}</text>
            )}
          </box>
        )}
      </For>
    </box>
  )
}
