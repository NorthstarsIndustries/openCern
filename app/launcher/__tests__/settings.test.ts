import { describe, it, expect, vi, beforeEach } from "vitest";
import * as os from "os";
import * as path from "path";

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

import type { LauncherConfig } from "../electron/config";

function defaultConfig(): LauncherConfig {
  return {
    setup_complete: false,
    docker_socket: "",
    update_interval_secs: 360,
    auto_start: true,
    data_dir: path.join(os.homedir(), "opencern-datasets"),
    custom_containers: [],
  };
}

describe("Settings management", () => {
  let loadConfig: () => LauncherConfig;
  let saveConfig: (cfg: LauncherConfig) => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../electron/config");
    loadConfig = mod.loadConfig;
    saveConfig = mod.saveConfig;
  });

  it("returns default settings when no config file exists", () => {
    mockExistsSync.mockReturnValue(false);
    const cfg = loadConfig();
    expect(cfg).toEqual(defaultConfig());
  });

  it("loads saved settings from disk", () => {
    const saved: LauncherConfig = {
      ...defaultConfig(),
      setup_complete: true,
      docker_socket: "/custom/docker.sock",
    };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(saved));

    const cfg = loadConfig();
    expect(cfg.setup_complete).toBe(true);
    expect(cfg.docker_socket).toBe("/custom/docker.sock");
  });

  it("saves settings and creates parent directory", () => {
    const cfg: LauncherConfig = {
      ...defaultConfig(),
      setup_complete: true,
      auto_start: false,
    };
    saveConfig(cfg);
    expect(mockMkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.any(String),
      JSON.stringify(cfg, null, 2),
    );
  });

  it("merges partial settings with defaults on load", () => {
    const partial = { setup_complete: true, docker_socket: "/sock" };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(partial));

    const cfg = loadConfig();
    expect(cfg.setup_complete).toBe(true);
    expect(cfg.docker_socket).toBe("/sock");
    expect(cfg.update_interval_secs).toBe(360);
    expect(cfg.auto_start).toBe(true);
    expect(cfg.data_dir).toBe(defaultConfig().data_dir);
    expect(cfg.custom_containers).toEqual([]);
  });

  it("returns defaults when config file is corrupted JSON", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("NOT VALID JSON {{{");

    const cfg = loadConfig();
    expect(cfg).toEqual(defaultConfig());
  });

  it("round-trips save and reload", () => {
    const cfg: LauncherConfig = {
      setup_complete: true,
      docker_socket: "/custom/sock",
      update_interval_secs: 120,
      auto_start: false,
      data_dir: "/my/data",
      custom_containers: [
        {
          id: "test-1",
          name: "my-container",
          image: "myimage:latest",
          ports: [{ host: 9090, container: 8080 }],
          volumes: [],
          env_vars: [],
          join_network: true,
        },
      ],
    };

    saveConfig(cfg);

    const writtenJson = mockWriteFileSync.mock.calls[0][1] as string;
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenJson);

    const reloaded = loadConfig();
    expect(reloaded).toEqual(cfg);
  });
});
