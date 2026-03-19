import React, { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Box, Settings as SettingsIcon, Loader2 } from "lucide-react";
import Titlebar from "./components/Titlebar";
import Setup from "./views/Setup";
import Dashboard from "./views/Dashboard";
import CustomContainers from "./views/CustomContainers";
import SettingsView from "./views/Settings";
import { useDocker } from "./hooks/useDocker";
import { useUpdater } from "./hooks/useUpdater";
import { useSettings } from "./hooks/useSettings";

type View = "dashboard" | "custom" | "settings";

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { id: "custom", label: "Custom", icon: <Box size={16} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={16} /> },
];

export default function App() {
  const { settings, loading: settingsLoading, saveSettings, reloadSettings } = useSettings();
  const [view, setView] = useState<View>("dashboard");
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);

  // Check setup status on mount
  React.useEffect(() => {
    if (!settingsLoading) {
      setSetupComplete(settings.setup_complete);
    }
  }, [settingsLoading, settings.setup_complete]);

  const docker = useDocker(settings.docker_socket, settings.data_dir);
  const updater = useUpdater(settings.docker_socket, settings.data_dir);

  const handleSetupComplete = useCallback(() => {
    setSetupComplete(true);
    reloadSettings();
  }, [reloadSettings]);

  const handlePullUpdates = useCallback(async () => {
    if (!updater.updateStatus) return;
    const images = updater.updateStatus.image_updates;
    if (images.length > 0) {
      try {
        // Get the full image names for the services that need updating
        const allImages = await invoke<string[]>("get_setup_images", {
          dataDir: settings.data_dir,
        });
        // Filter to only the ones that need updating
        const toUpdate = allImages.filter((img) =>
          images.some((name) => img.toLowerCase().includes(name.toLowerCase())),
        );
        if (toUpdate.length > 0) {
          await invoke("pull_images", {
            dockerSocket: settings.docker_socket,
            imageNames: toUpdate,
          });
        }
      } catch (err) {
        console.error("Failed to pull updates:", err);
      }
    }
    updater.dismissUpdates();
    docker.refresh();
  }, [updater, settings, docker]);

  // Show loading while checking setup status
  if (setupComplete === null) {
    return (
      <div
        className="h-full flex flex-col"
        style={{ background: "var(--color-bg-base)", borderRadius: 12 }}
      >
        <Titlebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--color-accent)" }} />
        </div>
      </div>
    );
  }

  // Show setup wizard if not completed
  if (!setupComplete) {
    return (
      <div
        className="h-full flex flex-col"
        style={{ background: "var(--color-bg-base)", borderRadius: 12 }}
      >
        <Titlebar />
        <Setup onComplete={handleSetupComplete} />
      </div>
    );
  }

  // Main app with navigation
  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--color-bg-base)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <Titlebar />

      {/* Content area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {view === "dashboard" && (
            <Dashboard
              containers={docker.containers}
              loading={docker.loading}
              error={docker.error}
              updateStatus={updater.updateStatus}
              hasUpdates={updater.hasUpdates}
              onStart={docker.startContainer}
              onStop={docker.stopContainer}
              onRestart={docker.restartContainer}
              onStartAll={docker.startAll}
              onStopAll={docker.stopAll}
              onOpenWebApp={docker.openWebApp}
              onCheckUpdates={updater.checkForUpdates}
              onDismissUpdates={updater.dismissUpdates}
              onPullUpdates={handlePullUpdates}
              getLogs={docker.getLogs}
              getStats={docker.getStats}
            />
          )}
          {view === "custom" && (
            <CustomContainers
              containers={docker.containers}
              onStart={docker.startContainer}
              onStop={docker.stopContainer}
              onRestart={docker.restartContainer}
              getLogs={docker.getLogs}
              getStats={docker.getStats}
              onRefresh={docker.refresh}
            />
          )}
          {view === "settings" && (
            <SettingsView settings={settings} onSave={saveSettings} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom navigation bar */}
      <div
        className="shrink-0 flex items-center justify-around px-2 py-2"
        style={{
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-bg-elevated)",
        }}
      >
        {navItems.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all duration-200 relative"
              style={{
                color: active ? "var(--color-accent)" : "var(--color-text-tertiary)",
                background: active ? "var(--color-accent-muted)" : "transparent",
              }}
            >
              {item.icon}
              <span className="text-xs font-medium" style={{ fontSize: 10 }}>
                {item.label}
              </span>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-3 right-3 h-0.5 rounded-full"
                  style={{ background: "var(--color-accent)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
