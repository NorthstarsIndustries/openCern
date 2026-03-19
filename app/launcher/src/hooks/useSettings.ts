import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface Settings {
  setup_complete: boolean;
  docker_socket: string;
  update_interval_secs: number;
  auto_start: boolean;
  data_dir: string;
  custom_containers: unknown[];
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    setup_complete: false,
    docker_socket: "",
    update_interval_secs: 360,
    auto_start: true,
    data_dir: "",
    custom_containers: [],
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      const result = await invoke<Settings>("get_settings");
      setSettings(result);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(async (updated: Partial<Settings>) => {
    const merged = { ...settings, ...updated };
    try {
      await invoke("save_settings", { settings: merged });
      setSettings(merged);
    } catch (err) {
      console.error("Failed to save settings:", err);
      throw err;
    }
  }, [settings]);

  return {
    settings,
    loading,
    saveSettings,
    reloadSettings: loadSettings,
  };
}
