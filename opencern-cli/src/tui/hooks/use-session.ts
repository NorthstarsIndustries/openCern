import { createSignal } from "solid-js"
import type { ChatMessage } from "../views/chat.js"
import type { ActivityEntry } from "../views/logs.js"

export function useSession() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = createSignal(false)
  const [streamingContent, setStreamingContent] = createSignal("")
  const [activity, setActivity] = createSignal<ActivityEntry[]>([])

  function addMessage(msg: ChatMessage) {
    setMessages(m => [...m, msg])
  }

  function addActivity(entry: Omit<ActivityEntry, "timestamp">) {
    setActivity(a => [...a, { ...entry, timestamp: Date.now() }])
  }

  function clearMessages() {
    setMessages([])
  }

  return {
    messages,
    isStreaming,
    streamingContent,
    activity,
    addMessage,
    addActivity,
    clearMessages,
    setIsStreaming,
    setStreamingContent,
  }
}
