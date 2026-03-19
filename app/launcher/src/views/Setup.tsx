import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Download, Loader2, AlertCircle, ExternalLink, ArrowRight } from "lucide-react";
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
const STEP_LABELS = ["Check Docker", "Download", "Ready"];

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

  useEffect(() => {
    checkDocker();
  }, [checkDocker]);

  useEffect(() => {
    const unlisten = listen<PullProgress>("pull-progress", (event) => {
      setPullProgress(event.payload);
      if (event.payload.stage === "error") {
        setPullError(event.payload.message);
        setPulling(false);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
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
    <div className="flex-1 flex flex-col" style={{ background: "var(--color-bg-base)" }}>
      {/* Top section with logo */}
      <div className="flex flex-col items-center pt-12 pb-6 px-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}
          >
            OpenCERN
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
            Initial Setup
          </p>
        </motion.div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1 px-12 pb-8">
        {STEPS.map((s, i) => {
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300"
                  style={{
                    background: isDone
                      ? "var(--color-status-running)"
                      : isActive
                      ? "var(--color-accent)"
                      : "var(--color-bg-surface)",
                    color: isDone || isActive ? "#fff" : "var(--color-text-tertiary)",
                    border: !isDone && !isActive ? "1px solid var(--color-border)" : "none",
                  }}
                >
                  {isDone ? <Check size={12} /> : i + 1}
                </div>
                <span
                  className="text-xs transition-colors duration-300"
                  style={{
                    color: isActive
                      ? "var(--color-text-primary)"
                      : isDone
                      ? "var(--color-text-secondary)"
                      : "var(--color-text-tertiary)",
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {STEP_LABELS[i]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-2 mb-5 transition-colors duration-300"
                  style={{
                    background: i < currentIndex
                      ? "var(--color-status-running)"
                      : "var(--color-border)",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col px-8">
        <AnimatePresence mode="wait">
          {/* Step 1: Docker check */}
          {step === "docker-check" && (
            <motion.div
              key="docker-check"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div
                className="rounded-xl p-6 flex-1 flex flex-col"
                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
              >
                {checking ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-accent)" }} />
                    <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      Checking Docker...
                    </p>
                  </div>
                ) : dockerInstalled && dockerRunning ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "var(--color-status-running-muted)" }}
                    >
                      <Check size={20} style={{ color: "var(--color-status-running)" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                        Docker is running
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                        Continuing to download...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: "var(--color-status-stopped-muted)" }}
                    >
                      <AlertCircle size={20} style={{ color: "var(--color-status-stopped)" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                        {!dockerInstalled ? "Docker is not installed" : "Docker is not running"}
                      </p>
                      <p className="text-xs mt-1.5 max-w-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {!dockerInstalled
                          ? "Docker is required to run OpenCERN services. Please install it and relaunch."
                          : "Start Docker Desktop and click Retry below."}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
                      {!dockerInstalled && installUrl && (
                        <a
                          href={installUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary text-center inline-flex items-center justify-center gap-2 text-sm"
                        >
                          Download Docker
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={checkDocker} className="btn-secondary w-full text-sm">
                        Retry
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 2: Pull images */}
          {step === "pull-images" && (
            <motion.div
              key="pull-images"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div
                className="rounded-xl p-6 flex-1 flex flex-col"
                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
              >
                <div className="text-center mb-5">
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    Download Services
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-tertiary)" }}>
                    This will pull the Docker images for all 5 OpenCERN services.
                  </p>
                </div>

                {pulling || pullComplete ? (
                  <div className="flex-1 flex flex-col justify-center gap-4">
                    <ProgressBar
                      percent={pullProgress?.percent ?? null}
                      label={pullProgress?.message ?? "Preparing..."}
                    />
                    {pullProgress && (
                      <p className="text-xs text-center" style={{ color: "var(--color-text-tertiary)" }}>
                        Image {pullProgress.index + 1} of {pullProgress.total}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-center gap-3">
                    {/* Service list preview */}
                    <div className="space-y-1.5 mb-3">
                      {["UI", "API", "XRootD", "Streamer", "Quantum"].map((name) => (
                        <div
                          key={name}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                          style={{ background: "var(--color-bg-surface)" }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: "var(--color-text-tertiary)" }}
                          />
                          <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {pullError && (
                      <div
                        className="text-xs p-3 rounded-lg"
                        style={{ background: "var(--color-status-stopped-muted)", color: "var(--color-status-stopped)" }}
                      >
                        {pullError}
                      </div>
                    )}

                    <button onClick={startPull} className="btn-primary w-full flex items-center justify-center gap-2">
                      <Download size={14} />
                      Download All
                    </button>
                    <button
                      onClick={() => setStep("ready")}
                      className="text-xs text-center py-1"
                      style={{ color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Skip for now
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 3: Ready */}
          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col"
            >
              <div
                className="rounded-xl p-6 flex-1 flex flex-col items-center justify-center"
                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
                  style={{ background: "var(--color-status-running-muted)" }}
                >
                  <Check size={24} style={{ color: "var(--color-status-running)" }} />
                </motion.div>
                <h2 className="text-base font-semibold mb-1.5" style={{ color: "var(--color-text-primary)" }}>
                  Setup Complete
                </h2>
                <p className="text-xs text-center max-w-xs mb-6" style={{ color: "var(--color-text-secondary)" }}>
                  OpenCERN is ready. You can manage all services from the dashboard.
                </p>
                <button
                  onClick={finishSetup}
                  className="btn-primary w-full max-w-xs flex items-center justify-center gap-2"
                >
                  Open Dashboard
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom spacer */}
      <div className="h-6" />
    </div>
  );
}
