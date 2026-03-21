import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  shell: { openExternal: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn(() => ({ minimize: vi.fn(), close: vi.fn() })) },
}));

vi.mock("../electron/containers", () => ({
  listContainers: vi.fn(),
  startContainer: vi.fn(),
  stopContainer: vi.fn(),
  restartContainer: vi.fn(),
  startAll: vi.fn(),
  stopAll: vi.fn(),
  getContainerLogs: vi.fn(),
  getContainerStats: vi.fn(),
  pullImages: vi.fn(),
  checkImageUpdates: vi.fn(),
  startCustomContainer: vi.fn(),
}));

vi.mock("../electron/setup", () => ({
  checkDocker: vi.fn(),
  getDockerInstallUrl: vi.fn(),
  getSetupStatus: vi.fn(),
  completeSetup: vi.fn(),
  getSetupImages: vi.fn(),
}));

vi.mock("../electron/config", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

vi.mock("../electron/updater", () => ({
  checkForUpdates: vi.fn(),
  downloadAppUpdate: vi.fn(),
  installAppUpdate: vi.fn(),
}));

vi.mock("../electron/custom", () => ({
  addCustomContainer: vi.fn(),
  removeCustomContainer: vi.fn(),
  listCustomContainers: vi.fn(),
  updateCustomContainer: vi.fn(),
}));

import { ipcMain } from "electron";
import * as containers from "../electron/containers";
import * as setup from "../electron/setup";
import * as config from "../electron/config";
import * as updater from "../electron/updater";
import { registerIpcHandlers } from "../electron/ipc";

type Handler = (event: unknown, args: Record<string, unknown>) => unknown;
let handlers: Record<string, Handler>;

beforeEach(() => {
  vi.clearAllMocks();
  handlers = {};
  vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Handler) => {
    handlers[channel] = handler;
    return undefined as never;
  });
  registerIpcHandlers();
});

describe("IPC: check_docker", () => {
  it("returns boolean status from setup.checkDocker", async () => {
    vi.mocked(setup.checkDocker).mockResolvedValue({ installed: true, running: true });
    const result = await handlers["check_docker"]({}, { dockerSocket: "" });
    expect(result).toEqual({ installed: true, running: true });
    expect(setup.checkDocker).toHaveBeenCalledWith("");
  });

  it("returns false when Docker is not available", async () => {
    vi.mocked(setup.checkDocker).mockResolvedValue({ installed: false, running: false });
    const result = await handlers["check_docker"]({}, { dockerSocket: "/tmp/fake.sock" });
    expect(result).toEqual({ installed: false, running: false });
  });
});

describe("IPC: get_setup_status", () => {
  it("returns setup state from setup module", () => {
    const state = { complete: false, docker: { installed: true, running: false } };
    vi.mocked(setup.getSetupStatus).mockReturnValue(state);
    const result = handlers["get_setup_status"]({}, {});
    expect(result).toEqual(state);
  });
});

describe("IPC: list_containers", () => {
  it("returns container list from containers module", async () => {
    const list = [
      { name: "UI", container_name: "opencern-ui", image: "ghcr.io/ceoatnorthstar/ui:latest", status: "Up", state: "running", ports: [{ host: 3000, container: 3000 }], description: "Next.js web interface", is_custom: false },
    ];
    vi.mocked(containers.listContainers).mockResolvedValue(list);

    const result = await handlers["list_containers"]({}, {
      dockerSocket: "",
      dataDir: "/data",
      customContainers: [],
    });
    expect(result).toEqual(list);
    expect(containers.listContainers).toHaveBeenCalledWith("", "/data", []);
  });
});

describe("IPC: start_container / stop_container", () => {
  it("start_container invokes Docker via containers module", async () => {
    vi.mocked(containers.startContainer).mockResolvedValue(undefined);
    await handlers["start_container"]({}, { name: "UI", dockerSocket: "", dataDir: "/data" });
    expect(containers.startContainer).toHaveBeenCalledWith("UI", "", "/data");
  });

  it("stop_container invokes Docker via containers module", async () => {
    vi.mocked(containers.stopContainer).mockResolvedValue(undefined);
    await handlers["stop_container"]({}, { name: "UI", dockerSocket: "" });
    expect(containers.stopContainer).toHaveBeenCalledWith("UI", "");
  });
});

describe("IPC: get_container_logs", () => {
  it("returns log lines as string array", async () => {
    vi.mocked(containers.getContainerLogs).mockResolvedValue(["line1", "line2"]);
    const result = await handlers["get_container_logs"]({}, { name: "API", dockerSocket: "", lines: 50 });
    expect(result).toEqual(["line1", "line2"]);
    expect(containers.getContainerLogs).toHaveBeenCalledWith("API", "", 50);
  });
});

describe("IPC: get_settings / save_settings", () => {
  it("get_settings returns config from disk", () => {
    const cfg = {
      setup_complete: true,
      docker_socket: "",
      update_interval_secs: 360,
      auto_start: true,
      data_dir: "/home/user/opencern-datasets",
      custom_containers: [],
    };
    vi.mocked(config.loadConfig).mockReturnValue(cfg);
    const result = handlers["get_settings"]({}, {});
    expect(result).toEqual(cfg);
  });

  it("save_settings writes config to disk", () => {
    const cfg = {
      setup_complete: true,
      docker_socket: "/custom/sock",
      update_interval_secs: 120,
      auto_start: false,
      data_dir: "/data",
      custom_containers: [],
    };
    handlers["save_settings"]({}, { settings: cfg });
    expect(config.saveConfig).toHaveBeenCalledWith(cfg);
  });
});

describe("IPC: check_image_updates", () => {
  it("returns list of outdated images", async () => {
    vi.mocked(containers.checkImageUpdates).mockResolvedValue(["UI", "API"]);
    const result = await handlers["check_image_updates"]({}, { dockerSocket: "", dataDir: "/data" });
    expect(result).toEqual(["UI", "API"]);
  });

  it("returns empty array when all images are current", async () => {
    vi.mocked(containers.checkImageUpdates).mockResolvedValue([]);
    const result = await handlers["check_image_updates"]({}, { dockerSocket: "", dataDir: "/data" });
    expect(result).toEqual([]);
  });
});

describe("IPC: updater handlers", () => {
  it("check_for_updates delegates to updater module", async () => {
    vi.mocked(updater.checkForUpdates).mockResolvedValue({
      image_updates: ["UI"],
      launcher_update: null,
    });
    const result = await handlers["check_for_updates"]({}, { dockerSocket: "", dataDir: "/data" });
    expect(result).toEqual({ image_updates: ["UI"], launcher_update: null });
  });

  it("download_app_update delegates to updater module", () => {
    handlers["download_app_update"]({}, {});
    expect(updater.downloadAppUpdate).toHaveBeenCalled();
  });

  it("install_app_update delegates to updater module", () => {
    handlers["install_app_update"]({}, {});
    expect(updater.installAppUpdate).toHaveBeenCalled();
  });
});
