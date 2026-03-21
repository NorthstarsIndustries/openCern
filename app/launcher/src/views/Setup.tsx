import { useState, useEffect, useCallback } from "react";
import { invoke, listen } from "../lib/ipc";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Download, AlertCircle, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import ProgressBar from "../components/ProgressBar";

interface SetupProps {
  onComplete: () => void;
}

interface PullProgress {
  image: string;
  index: number;
  total: number;
  stage: string;
  message: string;
  percent: number;
}

type Step = "docker-check" | "pull-images" | "ready";
const STEPS: Step[] = ["docker-check", "pull-images", "ready"];
const STEP_LABELS = ["Docker", "Download", "Ready"];

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState<Step>("docker-check");
  const [dockerInstalled, setDockerInstalled] = useState<boolean | null>(null);
  const [dockerRunning, setDockerRunning] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [installUrl, setInstallUrl] = useState("");

  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pullComplete, setPullComplete] = useState(false);

  const currentIndex = STEPS.indexOf(step);

  const checkDocker = useCallback(async () => {
    setChecking(true);
    try {
      const status = await invoke<{ installed: boolean; running: boolean }>("check_docker", {
        dockerSocket: "",
      });
      setDockerInstalled(status.installed);
      setDockerRunning(status.running);
      if (!status.installed) {
        const url = await invoke<string>("get_docker_install_url");
        setInstallUrl(url);
      }
      if (status.installed && status.running) {
        setTimeout(() => setStep("pull-images"), 600);
      }
    } catch {
      setDockerInstalled(false);
      setDockerRunning(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { checkDocker(); }, [checkDocker]);

  useEffect(() => {
    const unlisten = listen<PullProgress>("pull-progress", (event) => {
      setPullProgress(event.payload);
      if (event.payload.stage === "error") {
        setPullError(event.payload.message);
        setPulling(false);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const startPull = useCallback(async () => {
    setPulling(true);
    setPullError(null);
    try {
      const images = await invoke<string[]>("get_setup_images", { dataDir: "" });
      await invoke("pull_images", { dockerSocket: "", imageNames: images });
      setPullComplete(true);
      setPulling(false);
      setTimeout(() => setStep("ready"), 400);
    } catch (err) {
      setPullError(err instanceof Error ? err.message : String(err));
      setPulling(false);
    }
  }, []);

  const finishSetup = useCallback(async () => {
    try {
      await invoke("complete_setup");
      onComplete();
    } catch (err) {
      console.error("Failed to complete setup:", err);
    }
  }, [onComplete]);

  return (
    <div className="flex-1 flex">
      {/* Left panel — step indicator */}
      <div className="w-[200px] shrink-0 flex flex-col px-6 py-8 border-r border-border">
        <h2 className="text-sm font-semibold text-text-primary mb-8">Setup</h2>
        <div className="space-y-1">
          {STEPS.map((s, i) => {
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            return (
              <div key={s} className="flex items-center gap-3 py-2">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium ${
                    isDone
                      ? "bg-status-running text-bg-base"
                      : isActive
                      ? "bg-text-primary text-bg-base"
                      : "border border-border text-text-tertiary"
                  }`}
                >
                  {isDone ? <Check size={10} /> : i + 1}
                </div>
                <span
                  className={`text-xs ${
                    isActive
                      ? "text-text-primary font-semibold"
                      : isDone
                      ? "text-text-secondary"
                      : "text-text-tertiary"
                  }`}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel — step content */}
      <div className="flex-1 flex flex-col items-center justify-center px-12">
        <AnimatePresence mode="wait">
          {step === "docker-check" && (
            <motion.div
              key="docker-check"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm"
            >
              {checking ? (
                <div className="text-center">
                  <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-xs text-text-secondary">Checking Docker...</p>
                </div>
              ) : dockerInstalled && dockerRunning ? (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 bg-status-running-muted">
                    <Check size={16} className="text-status-running" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">Docker is running</p>
                  <p className="text-xs mt-1 text-text-tertiary">Continuing...</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 bg-status-stopped-muted">
                    <AlertCircle size={16} className="text-status-stopped" />
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {!dockerInstalled ? "Docker is not installed" : "Docker is not running"}
                  </p>
                  <p className="text-xs mt-1.5 max-w-xs mx-auto text-text-tertiary">
                    {!dockerInstalled
                      ? "Docker is required to run OpenCERN services."
                      : "Please start Docker Desktop and retry."}
                  </p>
                  <div className="flex flex-col gap-2 mt-5">
                    {!dockerInstalled && installUrl && (
                      <a
                        href={installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-text-primary text-bg-base h-8 px-4 text-xs font-medium hover:opacity-85 transition-opacity"
                      >
                        Download Docker
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <Button variant="secondary" onClick={checkDocker} className="w-full">
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === "pull-images" && (
            <motion.div
              key="pull-images"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm"
            >
              <h3 className="text-sm font-semibold text-center mb-1 text-text-primary">
                Download Services
              </h3>
              <p className="text-xs text-center mb-6 text-text-tertiary">
                Pull Docker images for all 5 OpenCERN services.
              </p>

              {pulling || pullComplete ? (
                <div className="space-y-3">
                  <ProgressBar
                    percent={pullProgress?.percent ?? null}
                    label={pullProgress?.message ?? "Preparing..."}
                  />
                  {pullProgress && (
                    <p className="text-[10px] text-center text-text-tertiary font-mono">
                      {pullProgress.index + 1} / {pullProgress.total}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {["UI", "API", "XRootD", "Streamer", "Quantum"].map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 px-3 py-2 rounded-md bg-bg-surface"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
                      <span className="text-xs text-text-secondary">{name}</span>
                    </div>
                  ))}

                  {pullError && (
                    <div className="text-xs p-3 rounded-md bg-status-stopped-muted text-status-stopped">
                      {pullError}
                    </div>
                  )}

                  <Button onClick={startPull} className="w-full gap-2">
                    <Download size={13} />
                    Download All
                  </Button>
                  <button
                    onClick={() => setStep("ready")}
                    className="text-xs text-center py-1 w-full text-text-tertiary bg-transparent border-none cursor-pointer hover:text-text-secondary transition-colors"
                  >
                    Skip for now
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm text-center"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 bg-status-running-muted">
                <Check size={16} className="text-status-running" />
              </div>
              <h3 className="text-sm font-semibold mb-1 text-text-primary">
                Setup Complete
              </h3>
              <p className="text-xs mb-6 text-text-tertiary">
                OpenCERN is ready. Manage services from the dashboard.
              </p>
              <Button onClick={finishSetup} className="w-full gap-2">
                Open Dashboard
                <ArrowRight size={13} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
