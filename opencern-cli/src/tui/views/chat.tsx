import { For, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { TextAttributes } from "@opentui/core"
import { Input } from "../components/input.js"

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp?: number
  tokens?: number
  model?: string
}

export function Chat(props: {
  messages: ChatMessage[]
  isStreaming: boolean
  streamingContent?: string
  onSubmit: (input: string) => void
  onCancel?: () => void
  model?: string
}) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Messages area */}
      <scrollbox flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
        <box flexDirection="column" gap={1}>
          <For each={props.messages}>
            {(msg) => (
              <box flexDirection="column">
                <box flexDirection="row" gap={1}>
                  <text
                    fg={msg.role === "user" ? theme.primary : msg.role === "assistant" ? theme.accent : theme.textMuted}
                    attributes={TextAttributes.BOLD}
                  >
                    {msg.role === "user" ? "You" : msg.role === "assistant" ? "AI" : "System"}
                  </text>
                  <Show when={msg.model}>
                    <text fg={theme.textMuted}>{msg.model}</text>
                  </Show>
                </box>
                <box paddingLeft={2}>
                  <text fg={theme.text} wrapMode="word">{msg.content}</text>
                </box>
              </box>
            )}
          </For>

          {/* Streaming content */}
          <Show when={props.isStreaming && props.streamingContent}>
            <box flexDirection="column">
              <text fg={theme.accent} attributes={TextAttributes.BOLD}>AI</text>
              <box paddingLeft={2}>
                <text fg={theme.text} wrapMode="word">{props.streamingContent}</text>
              </box>
            </box>
          </Show>

          <Show when={props.isStreaming && !props.streamingContent}>
            <box paddingLeft={2}>
              <text fg={theme.textMuted}>Thinking...</text>
            </box>
          </Show>
        </box>
      </scrollbox>

      {/* Input */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} flexShrink={0}>
        <Input
          placeholder={props.isStreaming ? "Generating... (Esc to cancel)" : "Ask a follow-up question..."}
          onSubmit={props.onSubmit}
          disabled={props.isStreaming}
        />
      </box>
    </box>
  )
}
