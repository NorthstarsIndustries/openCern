import { createMemo, For, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { Input } from "../components/input.js"
import { DEFAULT_THEMES } from "../context/theme.js"

const LOGO = [
  "     ___                    ____ _____ ____  _   _",
  "    / _ \\ _ __   ___ _ __  / ___| ____|  _ \\| \\ | |",
  "   | | | | '_ \\ / _ \\ '_ \\| |   |  _| | |_) |  \\| |",
  "   | |_| | |_) |  __/ | | | |___| |___|  _ <| |\\  |",
  "    \\___/| .__/ \\___|_| |_|\\____|_____|_| \\_\\_| \\_|",
  "         |_|",
]

const themeCount = Object.keys(DEFAULT_THEMES).length

type TipPart = { text: string; highlight: boolean }

function parseTip(tip: string): TipPart[] {
  const parts: TipPart[] = []
  const regex = /\{h\}(.*?)\{\/h\}/g
  let lastIndex = 0
  for (const match of tip.matchAll(regex)) {
    const start = match.index ?? 0
    if (start > lastIndex) {
      parts.push({ text: tip.slice(lastIndex, start), highlight: false })
    }
    parts.push({ text: match[1], highlight: true })
    lastIndex = start + match[0].length
  }
  if (lastIndex < tip.length) {
    parts.push({ text: tip.slice(lastIndex), highlight: false })
  }
  return parts
}

const TIPS = [
  "Type {h}/{/h} to see all available slash commands with autocomplete",
  `Use {h}/themes{/h} to switch between ${themeCount} built-in themes`,
  "Use {h}/download{/h} to fetch datasets from CERN Open Data Portal",
  "Use {h}/quantum{/h} to run quantum event classification on your data",
  "Press {h}Tab{/h} to cycle between views: Home, Docker, Quantum, Datasets, Logs",
  "Use {h}/docker{/h} to manage Docker containers for API and XRootD services",
  "Use {h}/ask{/h} followed by a question for AI-powered physics analysis",
  "Use {h}/process{/h} to run ROOT file processing on downloaded datasets",
  "Use {h}/stats{/h} or {h}/histogram{/h} for quick dataset statistics",
  "Press {h}Ctrl+C{/h} to exit, or type {h}/exit{/h}",
  "Use {h}/status{/h} to check Docker, API, and system health at a glance",
  "Use {h}/config{/h} to set your Anthropic API key and other settings",
  "Type any question without {h}/{/h} to chat directly with the AI assistant",
  "Use {h}/search{/h} to find datasets by experiment, particle type, or energy",
  "Press {h}Esc{/h} to go back to the Home view from any other view",
]

export function Home(props: {
  dockerStatus?: string
  apiStatus?: string
  onSubmit: (input: string) => void
}) {
  const { theme } = useTheme()
  const tip = parseTip(TIPS[Math.floor(Math.random() * TIPS.length)])

  return (
    <box flexDirection="column" flexGrow={1}>
      <box flexGrow={1} flexDirection="column" alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />

        {/* Logo */}
        <box flexShrink={0}>
          <box flexDirection="column">
            <For each={LOGO}>
              {(line) => <text fg={theme.primary}>{line}</text>}
            </For>
          </box>
        </box>

        <box height={1} minHeight={0} flexShrink={1} />

        {/* Status indicators */}
        <box flexShrink={0} flexDirection="row" gap={2}>
          <text fg={theme.text}>
            <span style={{ fg: props.dockerStatus === "running" ? theme.success : theme.error }}>
              {props.dockerStatus === "running" ? "● " : "○ "}
            </span>
            Docker
          </text>
          <text fg={theme.text}>
            <span style={{ fg: props.apiStatus === "connected" ? theme.success : theme.warning }}>
              {props.apiStatus === "connected" ? "● " : "○ "}
            </span>
            API
          </text>
        </box>

        <box height={1} minHeight={0} flexShrink={1} />

        {/* Input prompt */}
        <box width="100%" maxWidth={75} zIndex={1000} flexShrink={0}>
          <Input
            placeholder='Ask a physics question, or type / for commands...'
            onSubmit={props.onSubmit}
          />
        </box>

        {/* Tip */}
        <box width="100%" maxWidth={75} paddingTop={1} flexShrink={0}>
          <box flexDirection="row">
            <text flexShrink={0} fg={theme.warning}>
              {"● Tip "}
            </text>
            <text flexShrink={1} wrapMode="word">
              <For each={tip}>
                {(part) => (
                  <span style={{ fg: part.highlight ? theme.text : theme.textMuted }}>
                    {part.text}
                  </span>
                )}
              </For>
            </text>
          </box>
        </box>

        <box flexGrow={1} minHeight={0} />
      </box>

      {/* Bottom bar */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1} flexDirection="row" flexShrink={0} gap={2}>
        <text fg={theme.textMuted}>{process.cwd()}</text>
        <box flexGrow={1} />
        <text fg={theme.textMuted}>v1.0.0-beta.1</text>
      </box>
    </box>
  )
}
