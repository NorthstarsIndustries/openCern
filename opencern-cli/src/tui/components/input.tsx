import { createSignal, createMemo, createEffect, Index, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { useKeyboard } from "@opentui/solid"
import { registry } from "../../commands/registry.js"
import type { TextareaRenderable, ScrollBoxRenderable, KeyEvent } from "@opentui/core"

export interface AutocompleteOption {
  display: string
  description?: string
  onSelect: () => void
}

export function Input(props: {
  placeholder?: string
  onSubmit: (value: string) => void
  disabled?: boolean
}) {
  const { theme } = useTheme()
  let input: TextareaRenderable
  let scroll: ScrollBoxRenderable

  const [value, setValue] = createSignal("")
  const [showAutocomplete, setShowAutocomplete] = createSignal(false)
  const [selected, setSelected] = createSignal(0)

  // Build slash command options from registry
  const allCommands = createMemo((): AutocompleteOption[] => {
    return registry.getAll().map((cmd) => ({
      display: cmd.name.padEnd(16),
      description: cmd.description,
      onSelect: () => {
        input.setText(cmd.name + " ")
        setValue(cmd.name + " ")
        setShowAutocomplete(false)
        input.focus()
      },
    }))
  })

  // Add TUI-only commands
  const tuiCommands = createMemo((): AutocompleteOption[] => {
    const extra = [
      { name: "/themes", desc: "Switch TUI theme" },
      { name: "/docker", desc: "Docker container management" },
      { name: "/quantum", desc: "Quantum simulation view" },
      { name: "/logs", desc: "AI activity log" },
      { name: "/status", desc: "System status overview" },
    ]
    return extra.map((cmd) => ({
      display: cmd.name.padEnd(16),
      description: cmd.desc,
      onSelect: () => {
        input.setText("")
        setValue("")
        setShowAutocomplete(false)
        props.onSubmit(cmd.name)
      },
    }))
  })

  // Filtered options
  const options = createMemo(() => {
    const all = [...tuiCommands(), ...allCommands()]
    const v = value()
    if (!v.startsWith("/")) return all
    const query = v.toLowerCase()
    return all.filter(
      (opt) =>
        opt.display.trimEnd().toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)),
    )
  })

  // Reset selection when options change
  createEffect(() => {
    options()
    setSelected(0)
  })

  function onContentChange() {
    const text = input.plainText
    setValue(text)

    // Show autocomplete when typing /
    if (text.startsWith("/") && !text.includes(" ")) {
      setShowAutocomplete(true)
    } else {
      setShowAutocomplete(false)
    }
  }

  function onKeyDown(e: KeyEvent) {
    if (props.disabled) {
      e.preventDefault()
      return
    }

    if (showAutocomplete()) {
      const name = e.name?.toLowerCase()
      if (name === "up") {
        setSelected((s) => (s > 0 ? s - 1 : options().length - 1))
        e.preventDefault()
        return
      }
      if (name === "down") {
        setSelected((s) => (s < options().length - 1 ? s + 1 : 0))
        e.preventDefault()
        return
      }
      if (name === "return" || name === "tab") {
        const opt = options()[selected()]
        if (opt) opt.onSelect()
        e.preventDefault()
        return
      }
      if (name === "escape") {
        setShowAutocomplete(false)
        e.preventDefault()
        return
      }
    }
  }

  function onSubmit() {
    if (props.disabled) return
    if (showAutocomplete()) return
    const text = input.plainText.trim()
    if (!text) return
    props.onSubmit(text)
    input.setText("")
    setValue("")
  }

  const height = createMemo(() => Math.min(10, options().length || 1))

  return (
    <>
      {/* Autocomplete dropdown — renders above the input */}
      <Show when={showAutocomplete() && options().length > 0}>
        <box
          border={["top", "left", "right"]}
          borderColor={theme.border}
          backgroundColor={theme.backgroundPanel}
          maxHeight={10}
        >
          <scrollbox
            ref={(r: ScrollBoxRenderable) => (scroll = r)}
            height={height()}
            scrollbarOptions={{ visible: false }}
          >
            <Index each={options()}>
              {(option, index) => (
                <box
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={index === selected() ? theme.primary : undefined}
                  flexDirection="row"
                  onMouseOver={() => setSelected(index)}
                  onMouseUp={() => option().onSelect()}
                >
                  <text
                    fg={index === selected() ? theme.background : theme.text}
                    flexShrink={0}
                  >
                    {option().display}
                  </text>
                  <Show when={option().description}>
                    <text
                      fg={index === selected() ? theme.background : theme.textMuted}
                      wrapMode="none"
                    >
                      {option().description}
                    </text>
                  </Show>
                </box>
              )}
            </Index>
          </scrollbox>
        </box>
      </Show>

      {/* Input area */}
      <box
        border={["left"]}
        borderColor={theme.primary}
        customBorderChars={{
          vertical: "┃",
          horizontal: " ",
          topLeft: "",
          topRight: "",
          bottomLeft: "╹",
          bottomRight: "",
          topT: "",
          bottomT: "",
          cross: "",
          leftT: "",
          rightT: "",
        }}
      >
        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          flexShrink={0}
          backgroundColor={theme.backgroundElement}
          flexGrow={1}
        >
          <textarea
            placeholder={props.placeholder}
            textColor={props.disabled ? theme.textMuted : theme.text}
            focusedTextColor={props.disabled ? theme.textMuted : theme.text}
            minHeight={1}
            maxHeight={6}
            onContentChange={onContentChange}
            onKeyDown={onKeyDown}
            onSubmit={onSubmit}
            keyBindings={[
              { name: "return", action: "submit" },
              { name: "return", shift: true, action: "newline" },
              { name: "j", ctrl: true, action: "newline" },
            ]}
            ref={(r: TextareaRenderable) => {
              input = r
              if (!props.disabled) input.focus()
            }}
            focusedBackgroundColor={theme.backgroundElement}
            cursorColor={theme.text}
          />
          <box flexDirection="row" flexShrink={0} paddingTop={1} gap={2}>
            <text fg={theme.primary}>OpenCERN</text>
            <text fg={theme.textMuted}>/ commands</text>
          </box>
        </box>
      </box>
    </>
  )
}
