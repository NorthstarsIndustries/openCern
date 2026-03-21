import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckForUpdates = vi.fn();
const mockDownloadUpdate = vi.fn();
const mockQuitAndInstall = vi.fn();
const mockOn = vi.fn();

vi.mock("electron-updater", () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: true,
    checkForUpdates: mockCheckForUpdates,
    downloadUpdate: mockDownloadUpdate,
    quitAndInstall: mockQuitAndInstall,
    on: mockOn,
  },
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  app: {
    getVersion: vi.fn(() => "1.0.0"),
  },
}));

vi.mock("../electron/config", () => ({
  loadConfig: vi.fn(() => ({
    setup_complete: true,
    docker_socket: "",
    update_interval_secs: 360,
    auto_start: true,
    data_dir: "/data",
    custom_containers: [],
  })),
}));

vi.mock("../electron/containers", () => ({
  builtinServices: vi.fn(() => [
    { name: "UI", image: "ghcr.io/ceoatnorthstar/ui:latest", container_name: "opencern-ui" },
    { name: "API", image: "ghcr.io/ceoatnorthstar/api:latest", container_name: "opencern-api" },
  ]),
}));

vi.mock("../electron/docker", () => ({
  connect: vi.fn(),
}));

import * as docker from "../electron/docker";

describe("Auto-update logic", () => {
  let checkForUpdates: (dockerSocket: string, dataDir: string) => Promise<unknown>;
  let downloadAppUpdate: () => void;
  let installAppUpdate: () => void;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const updater = await import("../electron/updater");
    checkForUpdates = updater.checkForUpdates;
    downloadAppUpdate = updater.downloadAppUpdate;
    installAppUpdate = updater.installAppUpdate;
  });

  it("reports outdated images when inspect fails", async () => {
    vi.mocked(docker.connect).mockResolvedValue({
      getImage: vi.fn(() => ({
        inspect: vi.fn().mockRejectedValue(new Error("no such image")),
      })),
    } as never);

    const result = await checkForUpdates("", "/data");
    expect(result).toEqual(
      expect.objectContaining({
        image_updates: expect.arrayContaining(["UI", "API"]),
      }),
    );
  });

  it("reports no updates when all digests are present", async () => {
    vi.mocked(docker.connect).mockResolvedValue({
      getImage: vi.fn(() => ({
        inspect: vi.fn().mockResolvedValue({
          RepoDigests: ["ghcr.io/ceoatnorthstar/ui@sha256:abc123"],
        }),
      })),
    } as never);

    const result = await checkForUpdates("", "/data");
    expect(result).toEqual(
      expect.objectContaining({
        image_updates: [],
      }),
    );
  });

  it("returns empty image_updates on network error", async () => {
    vi.mocked(docker.connect).mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await checkForUpdates("", "/data");
    expect(result).toEqual(
      expect.objectContaining({
        image_updates: [],
      }),
    );
  });

  it("downloadAppUpdate triggers electron-updater download", () => {
    downloadAppUpdate();
    expect(mockDownloadUpdate).toHaveBeenCalled();
  });

  it("installAppUpdate triggers quit-and-install", () => {
    installAppUpdate();
    expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it("checkForUpdates always includes launcher_update field", async () => {
    vi.mocked(docker.connect).mockRejectedValue(new Error("no docker"));
    const result = (await checkForUpdates("", "/data")) as Record<string, unknown>;
    expect(result).toHaveProperty("launcher_update");
  });
});

describe("Version comparison logic", () => {
  it("detects newer image is available when RepoDigests is empty", async () => {
    vi.mocked(docker.connect).mockResolvedValue({
      getImage: vi.fn(() => ({
        inspect: vi.fn().mockResolvedValue({ RepoDigests: [] }),
      })),
    } as never);

    const { checkForUpdates: check } = await import("../electron/updater");
    const result = await check("", "/data");
    expect(result).toEqual(
      expect.objectContaining({
        image_updates: expect.arrayContaining(["UI", "API"]),
      }),
    );
  });

  it("same version — no update when digests match", async () => {
    vi.mocked(docker.connect).mockResolvedValue({
      getImage: vi.fn(() => ({
        inspect: vi.fn().mockResolvedValue({
          RepoDigests: ["ghcr.io/ceoatnorthstar/ui@sha256:current"],
        }),
      })),
    } as never);

    const { checkForUpdates: check } = await import("../electron/updater");
    const result = await check("", "/data");
    expect(result).toEqual(
      expect.objectContaining({
        image_updates: [],
      }),
    );
  });
});
