import { render, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { Switch, Match, createSignal, createEffect, ErrorBoundary, batch, Show } from "solid-js"
import { RouteProvider, useRoute } from "./context/route.js"
import { ThemeProvider, useTheme } from "./context/theme.js"
import { ExitProvider, useExit } from "./context/exit.js"
import { Sidebar } from "./layout/sidebar.js"
import { Statusbar } from "./layout/statusbar.js"
import { Home } from "./views/home.js"
import { Chat, type ChatMessage } from "./views/chat.js"
import { Docker } from "./views/docker.js"
import { Quantum, type QuantumJob } from "./views/quantum.js"
import { Datasets, type DatasetInfo } from "./views/datasets.js"
import { Logs, type ActivityEntry } from "./views/logs.js"
import { Setup } from "./views/setup.js"
import { Dialog } from "./components/dialog.js"
import { SelectList, type ListItem } from "./components/list.js"
import { useDocker } from "./hooks/use-docker.js"
import { useSession } from "./hooks/use-session.js"

import { config } from "../utils/config.js"
import { anthropicService, type AgenticEvent, type ToolCall, type ToolResult } from "../services/anthropic.js"
import { docker } from "../services/docker.js"
import { registry } from "../commands/registry.js"
import { dispatch, isTuiHandled } from "../commands/dispatcher.js"
import { add as addHistory } from "../utils/history.js"
import { isAuthenticated } from "../utils/auth.js"
import { getHelpText } from "../commands/help.js"
import { getSystemStatus, formatStatus } from "../commands/status.js"
import { listLocalDatasets } from "../commands/datasets.js"
import { DEFAULT_THEMES } from "./context/theme.js"

export function tui() {
  return new Promise<void>(async (resolve) => {
    const onExit = async () => {
      resolve()
    }

    render(
      () => (
        <ErrorBoundary fallback={(error) => <ErrorScreen error={error} />}>
          <ExitProvider onExit={onExit}>
            <RouteProvider>
              <ThemeProvider mode="dark">
                <App />
              </ThemeProvider>
            </RouteProvider>
          </ExitProvider>
        </ErrorBoundary>
      ),
      {
        targetFps: 60,
        exitOnCtrlC: false,
        autoFocus: false,
      },
    )
  })
}

function App() {
  const route = useRoute()
  const { theme, set: setTheme, all: allThemes, selected: selectedTheme } = useTheme()
  const dimensions = useTerminalDimensions()
  const renderer = useRenderer()
  const exit = useExit()

  // State
  const dockerHook = useDocker()
  const session = useSession()
  const [dockerStatus, setDockerStatus] = createSignal<string>("checking")
  const [apiStatus, setApiStatus] = createSignal<string>("checking")
  const [datasets, setDatasets] = createSignal<DatasetInfo[]>([])
  const [quantumJobs, setQuantumJobs] = createSignal<QuantumJob[]>([])
  const [showThemeDialog, setShowThemeDialog] = createSignal(false)
  const [showHelpDialog, setShowHelpDialog] = createSignal(false)
  const [showCommandPalette, setShowCommandPalette] = createSignal(false)

  // Check Docker status
  createEffect(() => {
    const running = dockerHook.isRunning()
    setDockerStatus(running ? "running" : "stopped")
    if (running) {
      docker.isApiReady().then(ready => {
        setApiStatus(ready ? "connected" : "disconnected")
      }).catch(() => setApiStatus("disconnected"))
    }
  })

  // Load datasets
  createEffect(() => {
    if (route.data.type === "datasets") {
      try {
        const local = listLocalDatasets()
        setDatasets(local.map((d: any) => ({
          name: d.name || d.id || "unknown",
          size: d.size ? `${(d.size / 1e6).toFixed(1)} MB` : "?",
          events: d.events,
          path: d.path || "",
          downloaded: true,
        })))
      } catch {
        setDatasets([])
      }
    }
  })

  // Startup
  createEffect(() => {
    config.load()
    // Auto-navigate to setup on first run
    if (config.isFirstRun()) {
      route.navigate({ type: "setup" })
      return
    }
    if (config.get("autoStartDocker")) {
      docker.isDockerRunning().then(running => {
        if (running) docker.startContainers().catch(() => {})
      })
    }
  })

  // Key bindings
  useKeyboard((evt) => {
    if (evt.ctrl && evt.name === "c") {
      renderer.destroy()
      exit()
      return
    }

    if (evt.ctrl && evt.name === "k") {
      setShowCommandPalette(p => !p)
      evt.preventDefault()
      return
    }

    if (evt.name === "tab" && !showCommandPalette() && !showThemeDialog()) {
      const views: Array<"home" | "session" | "docker" | "quantum" | "datasets" | "logs"> = ["home", "session", "docker", "quantum", "datasets", "logs"]
      // Don't cycle away from setup view
      if (route.data.type === "setup") { evt.preventDefault(); return }
      const currentIdx = views.indexOf(route.data.type as any)
      const next = views[(currentIdx + 1) % views.length]
      route.navigate({ type: next })
      evt.preventDefault()
      return
    }

    if (evt.name === "escape") {
      if (showThemeDialog()) { setShowThemeDialog(false); evt.preventDefault(); return }
      if (showHelpDialog()) { setShowHelpDialog(false); evt.preventDefault(); return }
      if (showCommandPalette()) { setShowCommandPalette(false); evt.preventDefault(); return }
      if (route.data.type !== "home") {
        route.navigate({ type: "home" })
        evt.preventDefault()
        return
      }
    }

    // q to quit only works when no view has focus (Ctrl+C always works)

  })

  // Command handler
  async function handleInput(raw: string) {
    const input = raw.trim()
    if (!input) return
    addHistory(input)

    // Slash commands
    if (input.startsWith("/")) {
      const parts = input.split(/\s+/)
      const cmd = parts[0].toLowerCase()

      switch (cmd) {
        case "/help":
          setShowHelpDialog(true)
          return
        case "/exit":
        case "/quit":
          renderer.destroy()
          exit()
          return
        case "/themes":
        case "/theme":
          setShowThemeDialog(true)
          return
        case "/docker":
          route.navigate({ type: "docker" })
          return
        case "/quantum":
          route.navigate({ type: "quantum" })
          return
        case "/datasets":
          route.navigate({ type: "datasets" })
          return
        case "/logs":
          route.navigate({ type: "logs" })
          return
        case "/status": {
          session.addActivity({ type: "command", message: "/status" })
          try {
            const status = await getSystemStatus()
            const text = formatStatus(status).join("\n")
            session.addMessage({ role: "system", content: text })
          } catch (e) {
            session.addMessage({ role: "system", content: `Error: ${(e as Error).message}` })
          }
          route.navigate({ type: "session" })
          return
        }
        default: {
          // Commands that need TUI-level handling (AI queries)
          if (cmd === "/ask" || cmd === "/opask") {
            const query = input.slice(cmd.length).trim() || input.slice(1)
            await runAgenticQuery(query)
            return
          }

          // Try dispatcher for all registered commands
          const found = registry.find(cmd)
          if (found) {
            session.addActivity({ type: "command", message: input })
            try {
              const result = await dispatch(input)
              if (result.output === "__CLEAR__") {
                session.clearMessages()
              } else if (result.output) {
                session.addMessage({ role: "system", content: result.output })
              }
              if (result.navigateTo) {
                route.navigate({ type: result.navigateTo as any })
              } else {
                route.navigate({ type: "session" })
              }
            } catch (e) {
              session.addMessage({ role: "system", content: `Error: ${(e as Error).message}` })
              route.navigate({ type: "session" })
            }
          } else {
            // Delegate unknown input to AI
            await runAgenticQuery(input.slice(1))
          }
          return
        }
      }
    }

    // Free-form → AI query
    await runAgenticQuery(input)
  }

  async function runAgenticQuery(question: string) {
    session.addMessage({ role: "user", content: question })
    session.addActivity({ type: "command", message: `Ask: ${question}` })
    session.setIsStreaming(true)
    session.setStreamingContent("")
    route.navigate({ type: "session" })

    const abortController = new AbortController()

    try {
      await anthropicService.agenticStream(
        question,
        (event: AgenticEvent) => {
          switch (event.type) {
            case "text":
              session.setStreamingContent(c => c + (event.text || ""))
              break
            case "tool_call":
              if (event.toolCall) {
                session.addActivity({
                  type: "tool",
                  message: `Tool: ${event.toolCall.name}`,
                  detail: JSON.stringify(event.toolCall.input).slice(0, 100),
                })
              }
              break
            case "tool_result":
              if (event.toolResult) {
                session.addActivity({
                  type: "info",
                  message: `Tool result: ${event.toolResult.toolUseId}`,
                })
              }
              break
            case "done": {
              const content = session.streamingContent()
              session.setIsStreaming(false)
              session.setStreamingContent("")
              if (content) {
                session.addMessage({
                  role: "assistant",
                  content,
                  tokens: event.totalTokens,
                  model: config.get("defaultModel"),
                })
              }
              session.addActivity({ type: "info", message: `Response complete (${event.totalTokens} tokens)` })
              break
            }
            case "error":
              session.setIsStreaming(false)
              session.addMessage({ role: "system", content: `Error: ${event.error}` })
              session.addActivity({ type: "error", message: `Error: ${event.error}` })
              break
          }
        },
        async (toolCall: ToolCall) => true, // Auto-approve for now
        abortController.signal,
      )
    } catch (err) {
      session.setIsStreaming(false)
      const msg = (err as Error).message
      if (msg.includes("API key")) {
        session.addMessage({ role: "system", content: "Anthropic API key not configured. Run /config or /keys set anthropic <key>" })
      } else {
        session.addMessage({ role: "system", content: `Error: ${msg}` })
      }
    }
  }

  // Theme list for dialog
  const themeList = (): ListItem[] => {
    return Object.keys(allThemes()).map(name => ({
      label: name === selectedTheme ? `● ${name}` : `  ${name}`,
      value: name,
    }))
  }

  const sidebarWidth = 22

  return (
    <box
      width={dimensions().width}
      height={dimensions().height}
      backgroundColor={theme.background}
      flexDirection="row"
    >
      {/* Sidebar */}
      <Sidebar
        width={sidebarWidth}
        dockerCount={dockerHook.containers().length}
        datasetCount={datasets().length}
        quantumJobs={quantumJobs().length}
      />

      {/* Main content */}
      <box flexDirection="column" flexGrow={1}>
        {/* Views */}
        <Switch>
          <Match when={route.data.type === "home"}>
            <Home
              dockerStatus={dockerStatus()}
              apiStatus={apiStatus()}
              onSubmit={handleInput}
            />
          </Match>
          <Match when={route.data.type === "session"}>
            <Chat
              messages={session.messages()}
              isStreaming={session.isStreaming()}
              streamingContent={session.streamingContent()}
              onSubmit={handleInput}
              model={config.get("defaultModel")}
            />
          </Match>
          <Match when={route.data.type === "docker"}>
            <Docker
              containers={dockerHook.containers()}
              isLoading={dockerHook.isLoading()}
              onStartAll={() => dockerHook.startAll()}
              onStopAll={() => dockerHook.stopAll()}
              onPull={() => docker.pullImages()}
            />
          </Match>
          <Match when={route.data.type === "quantum"}>
            <Quantum
              jobs={quantumJobs()}
              backendStatus="offline"
            />
          </Match>
          <Match when={route.data.type === "datasets"}>
            <Datasets
              datasets={datasets()}
              isLoading={false}
            />
          </Match>
          <Match when={route.data.type === "logs"}>
            <Logs entries={session.activity()} />
          </Match>
          <Match when={route.data.type === "setup"}>
            <Setup />
          </Match>
        </Switch>

        {/* Status bar */}
        <Statusbar
          dockerStatus={dockerStatus()}
          apiStatus={apiStatus()}
          model={config.get("defaultModel")}
        />
      </box>

      {/* Theme dialog */}
      <Dialog
        title="Switch Theme"
        visible={showThemeDialog()}
        onClose={() => setShowThemeDialog(false)}
        width={40}
        height={20}
      >
        <SelectList
          items={themeList()}
          onSelect={(value) => {
            setTheme(value)
            setShowThemeDialog(false)
          }}
          onCancel={() => setShowThemeDialog(false)}
        />
      </Dialog>

      {/* Help dialog */}
      <Dialog
        title="Help"
        visible={showHelpDialog()}
        onClose={() => setShowHelpDialog(false)}
        width={70}
        height={25}
      >
        <scrollbox flexGrow={1}>
          <text fg={theme.text} wrapMode="word">
            {getHelpText().join("\n")}
          </text>
        </scrollbox>
      </Dialog>
    </box>
  )
}

function ErrorScreen(props: { error: Error }) {
  return (
    <box flexDirection="column" gap={1} paddingLeft={2} paddingTop={1}>
      <text fg={RGBA_RED}>A fatal error occurred!</text>
      <text fg={RGBA_GRAY}>{props.error.message}</text>
      <text fg={RGBA_GRAY}>{props.error.stack}</text>
      <text fg={RGBA_GRAY}>Press Ctrl+C to exit.</text>
    </box>
  )
}

// Simple fallback colors for error screen (no theme available)
const RGBA_RED = "#e06c75"
const RGBA_GRAY = "#808080"
