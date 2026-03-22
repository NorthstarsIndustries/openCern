import { createSignal, createEffect, Show } from "solid-js"
import { useTheme } from "../context/theme.js"
import { useRoute } from "../context/route.js"
import { Input } from "../components/input.js"
import { Progress } from "../components/progress.js"

type SetupStep = 'docker-check' | 'container-pull' | 'api-health' | 'auth' | 'done'

export function Setup() {
  const { theme } = useTheme()
  const route = useRoute()
  const [step, setStep] = createSignal<SetupStep>('docker-check')
  const [status, setStatus] = createSignal('')
  const [error, setError] = createSignal('')
  const [progress, setProgress] = createSignal(0)
  const [authCode, setAuthCode] = createSignal('')
  const [authUrl, setAuthUrl] = createSignal('')

  createEffect(() => {
    runStep()
  })

  async function runStep() {
    const current = step()

    if (current === 'docker-check') {
      setStatus('Checking Docker...')
      try {
        const { docker } = await import('../../services/docker.js')
        const running = await docker.isDockerRunning()
        if (running) {
          setStatus('Docker is running.')
          setProgress(25)
          setStep('container-pull')
        } else {
          setError('Docker is not running. Please install and start Docker Desktop, then run /setup again.')
        }
      } catch {
        setError('Could not check Docker status. Is Docker installed?')
      }
    }

    if (current === 'container-pull') {
      setStatus('Pulling container images...')
      try {
        const { docker } = await import('../../services/docker.js')
        await docker.pullImages()
        setStatus('Images pulled successfully.')
        setProgress(50)
        setStep('api-health')
      } catch {
        setStatus('Pulling images failed, trying to start existing containers...')
        setStep('api-health')
      }
    }

    if (current === 'api-health') {
      setStatus('Starting containers and checking API health...')
      try {
        const { docker } = await import('../../services/docker.js')
        await docker.startContainers()
        await new Promise(r => setTimeout(r, 3000))
        const ready = await docker.isApiReady()
        if (ready) {
          setStatus('API is healthy!')
          setProgress(75)
          setStep('auth')
        } else {
          setStatus('API not ready yet. You can authenticate now and check /health later.')
          setProgress(75)
          setStep('auth')
        }
      } catch {
        setStatus('Could not start containers. You can still use offline features.')
        setProgress(75)
        setStep('auth')
      }
    }

    if (current === 'auth') {
      setStatus('Ready for authentication.')
      setProgress(80)
    }
  }

  async function startAuth(method: string) {
    if (method === 'oauth') {
      setStatus('Starting OAuth login...')
      try {
        const { login } = await import('../../commands/auth.js')
        const result = await login(
          (code, url) => {
            setAuthCode(code)
            setAuthUrl(url)
            setStatus(`Enter code: ${code}`)
          },
          () => setStatus('Waiting for authorization...')
        )
        if (result.success) {
          setStatus(`Authenticated as ${result.username}!`)
          setProgress(100)
          setStep('done')
        } else {
          setError(result.error || 'Authentication failed.')
        }
      } catch (e) {
        setError((e as Error).message)
      }
    }
  }

  function handleApiKey(key: string) {
    if (!key.trim()) return
    try {
      const { setKey } = require('../../utils/keystore.js')
      setKey('anthropic', key.trim())
      setStatus('API key saved!')
      setProgress(100)
      setStep('done')
    } catch (e) {
      setError(`Failed to save key: ${(e as Error).message}`)
    }
  }

  function finishSetup() {
    route.navigate({ type: 'home' })
  }

  const stepLabels: Record<SetupStep, string> = {
    'docker-check': '1. Docker Check',
    'container-pull': '2. Pull Containers',
    'api-health': '3. Start Services',
    'auth': '4. Authentication',
    'done': 'Setup Complete!',
  }

  return (
    <box flexDirection="column" paddingLeft={2} paddingTop={1} flexGrow={1}>
      <text fg={theme.accent}>
        OpenCERN First-Time Setup
      </text>
      <text fg={theme.textMuted}>
        ────────────────────────────────────────
      </text>

      {/* Progress */}
      <box marginTop={1}>
        <text fg={theme.text}>
          Step: {stepLabels[step()]} ({progress()}%)
        </text>
      </box>

      <box marginTop={1} width={50}>
        <Progress percent={progress()} />
      </box>

      {/* Status */}
      <box marginTop={1}>
        <text fg={theme.text}>{status()}</text>
      </box>

      <Show when={error()}>
        <box marginTop={1}>
          <text fg="#e06c75">{error()}</text>
        </box>
      </Show>

      {/* Auth step */}
      <Show when={step() === 'auth'}>
        <box flexDirection="column" marginTop={1} gap={1}>
          <text fg={theme.text}>Choose authentication method:</text>
          <text fg={theme.textMuted}>  1. Sign in with OpenCERN (OAuth) — recommended</text>
          <text fg={theme.textMuted}>  2. Enter Anthropic API key directly</text>

          <Show when={authCode()}>
            <box marginTop={1}>
              <text fg={theme.accent}>Code: {authCode()}</text>
            </box>
            <text fg={theme.textMuted}>Open this URL in your browser:</text>
            <text fg={theme.accent}>{authUrl()}</text>
          </Show>

          <Show when={!authCode()}>
            <box marginTop={1}>
              <Input
                placeholder="Type '1' for OAuth or paste API key..."
                onSubmit={(val: string) => {
                  if (val.trim() === '1') startAuth('oauth')
                  else if (val.startsWith('sk-')) handleApiKey(val)
                  else if (val.trim() === '2') setStatus('Paste your Anthropic API key (starts with sk-)')
                }}
              />
            </box>
          </Show>
        </box>
      </Show>

      {/* Done */}
      <Show when={step() === 'done'}>
        <box flexDirection="column" marginTop={1} gap={1}>
          <text fg="#98c379">Setup complete!</text>
          <text fg={theme.text}>You're ready to use OpenCERN.</text>
          <text fg={theme.textMuted}>Press Enter or type /help to get started.</text>
          <Input
            placeholder="Press Enter to continue..."
            onSubmit={() => finishSetup()}
          />
        </box>
      </Show>
    </box>
  )
}
