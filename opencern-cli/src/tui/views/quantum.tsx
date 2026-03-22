import { Show, For } from "solid-js"
import { useTheme } from "../context/theme.js"
import { TextAttributes } from "@opentui/core"

export interface QuantumJob {
  id: string
  status: "queued" | "running" | "completed" | "failed"
  backend: string
  qubits: number
  shots: number
  progress?: number
  results?: {
    signalCount: number
    backgroundCount: number
    signalProbability: number
    fidelity: number
  }
}

export function Quantum(props: {
  jobs: QuantumJob[]
  backendStatus?: string
  circuitDiagram?: string
  onRun?: (file: string) => void
}) {
  const { theme } = useTheme()

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1}>
      <box flexDirection="row" gap={2} flexShrink={0} paddingBottom={1}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>Quantum Computing</text>
        <text fg={props.backendStatus === "healthy" ? theme.success : theme.warning}>
          {props.backendStatus === "healthy" ? "● Online" : "○ Offline"}
        </text>
      </box>

      {/* Circuit diagram */}
      <Show when={props.circuitDiagram}>
        <box flexShrink={0} paddingBottom={1}>
          <text fg={theme.textMuted}>{props.circuitDiagram}</text>
        </box>
      </Show>

      {/* Job list */}
      <scrollbox flexGrow={1}>
        <box flexDirection="column" gap={1}>
          <Show when={props.jobs.length === 0}>
            <text fg={theme.textMuted}>
              No quantum jobs. Run /quantum classify &lt;file&gt; to start.
            </text>
          </Show>

          <For each={props.jobs}>
            {(job) => (
              <box flexDirection="column" backgroundColor={theme.backgroundPanel} paddingLeft={2} paddingRight={1}>
                <box flexDirection="row" gap={2}>
                  <text fg={
                    job.status === "completed" ? theme.success :
                    job.status === "running" ? theme.info :
                    job.status === "failed" ? theme.error :
                    theme.textMuted
                  }>
                    {job.status === "running" ? "◌" : job.status === "completed" ? "●" : "○"}
                  </text>
                  <text fg={theme.text}>{job.id}</text>
                  <text fg={theme.textMuted}>{job.backend}</text>
                  <text fg={theme.textMuted}>{job.qubits}q {job.shots}shots</text>
                </box>
                <Show when={job.results}>
                  <box paddingLeft={4} flexDirection="row" gap={2}>
                    <text fg={theme.success}>Signal: {job.results!.signalCount}</text>
                    <text fg={theme.textMuted}>BG: {job.results!.backgroundCount}</text>
                    <text fg={theme.info}>Fidelity: {job.results!.fidelity.toFixed(3)}</text>
                  </box>
                </Show>
              </box>
            )}
          </For>
        </box>
      </scrollbox>

      <box flexDirection="row" gap={2} paddingTop={1} flexShrink={0}>
        <text fg={theme.textMuted}>/quantum classify &lt;file&gt;  /quantum status</text>
      </box>
    </box>
  )
}
