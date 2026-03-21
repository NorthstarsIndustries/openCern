import React, { useState, useCallback, useEffect } from "react";
import { invoke } from "./lib/ipc";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Box,
  Settings as SettingsIcon,
  ExternalLink,
} from "lucide-react";
import { TooltipProvider } from "./components/ui/tooltip";
import { Button } from "./components/ui/button";
import Titlebar from "./components/Titlebar";
import Splash from "./views/Splash";
import Setup from "./views/Setup";
import Dashboard from "./views/Dashboard";
import CustomContainers from "./views/CustomContainers";
import SettingsView from "./views/Settings";
import { useDocker } from "./hooks/useDocker";
import { useUpdater } from "./hooks/useUpdater";
import { useSettings } from "./hooks/useSettings";

type View = "dashboard" | "custom" | "settings";

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Services", icon: <LayoutDashboard size={16} /> },
  { id: "custom", label: "Containers", icon: <Box size={16} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={16} /> },
];

export default function App() {
  const { settings, loading: settingsLoading, saveSettings, reloadSettings } = useSettings();
  const [view, setView] = useState<View>("dashboard");
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
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
        const allImages = await invoke<string[]>("get_setup_images", {
          dataDir: settings.data_dir,
        });
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

  if (showSplash) {
    return <Splash onFinish={() => setShowSplash(false)} />;
  }

  if (setupComplete === null) {
    return (
      <div className="h-full flex flex-col bg-bg-base">
        <Titlebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!setupComplete) {
    return (
      <div className="h-full flex flex-col bg-bg-base">
        <Titlebar />
        <Setup onComplete={handleSetupComplete} />
      </div>
    );
  }

  const runningCount = docker.containers.filter((c) => c.state === "running").length;
  const totalCount = docker.containers.length;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full flex flex-col bg-bg-base">
        <Titlebar />

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[200px] shrink-0 flex flex-col border-r border-border">
            <div className="px-5 pt-4 pb-6">
              <h1 className="text-sm font-semibold tracking-tight text-text-primary">
                OpenCERN
              </h1>
              <p className="text-xs mt-0.5 text-text-tertiary">
                {runningCount}/{totalCount} services active
              </p>
            </div>

            <nav className="flex-1 px-3 space-y-0.5">
              {navItems.map((item) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all duration-100 ${
                      active
                        ? "text-text-primary bg-accent-muted"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="px-3 pb-4">
              <Button
                onClick={docker.openWebApp}
                className="w-full gap-2"
                size="default"
              >
                <ExternalLink size={13} />
                Open in Browser
              </Button>
            </div>
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
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
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
