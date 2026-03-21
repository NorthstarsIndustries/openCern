import { describe, it, expect, vi, beforeEach } from "vitest";
import * as os from "os";
import * as path from "path";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("dockerode", () => {
  return {
    default: vi.fn(),
  };
});

import * as fs from "fs";
import { execSync } from "child_process";
import Docker from "dockerode";

const mockPing = vi.fn();
const MockDocker = vi.mocked(Docker);

beforeEach(() => {
  vi.clearAllMocks();
  mockPing.mockResolvedValue("OK");
  MockDocker.mockImplementation(
    () => ({ ping: mockPing }) as unknown as Docker,
  );
});

describe("Docker socket detection — connect()", () => {
  let connect: (customSocket: string) => Promise<Docker>;

  beforeEach(async () => {
    const mod = await import("../electron/docker");
    connect = mod.connect;
  });

  it("uses custom socket when provided", async () => {
    const result = await connect("/custom/docker.sock");
    expect(MockDocker).toHaveBeenCalledWith({ socketPath: "/custom/docker.sock" });
    expect(mockPing).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("finds default macOS socket /var/run/docker.sock", async () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => p === "/var/run/docker.sock");
    const result = await connect("");
    expect(MockDocker).toHaveBeenCalledWith({ socketPath: "/var/run/docker.sock" });
    expect(result).toBeDefined();
  });

  it("finds Colima socket ~/.colima/default/docker.sock", async () => {
    const home = os.homedir();
    const colimaPath = path.join(home, ".colima/default/docker.sock");
    vi.mocked(fs.existsSync).mockImplementation((p) => p === colimaPath);
    const result = await connect("");
    expect(MockDocker).toHaveBeenCalledWith({ socketPath: colimaPath });
    expect(result).toBeDefined();
  });

  it("finds Rancher Desktop socket ~/.rd/docker.sock", async () => {
    const home = os.homedir();
    const rancherPath = path.join(home, ".rd/docker.sock");
    vi.mocked(fs.existsSync).mockImplementation((p) => p === rancherPath);
    const result = await connect("");
    expect(MockDocker).toHaveBeenCalledWith({ socketPath: rancherPath });
    expect(result).toBeDefined();
  });

  it("tries Windows named pipe on win32", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });

    vi.mocked(fs.existsSync).mockReturnValue(false);
    const result = await connect("");
    expect(MockDocker).toHaveBeenCalledWith(
      expect.objectContaining({ socketPath: "//./pipe/docker_engine" }),
    );

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("returns null-ish / throws when no socket found and ping fails", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    mockPing.mockRejectedValue(new Error("connection refused"));

    MockDocker.mockImplementation(
      () => ({ ping: mockPing }) as unknown as Docker,
    );

    await expect(connect("")).rejects.toThrow();
  });
});

describe("Docker CLI detection — isDockerInstalled()", () => {
  let isDockerInstalled: () => boolean;

  beforeEach(async () => {
    const mod = await import("../electron/docker");
    isDockerInstalled = mod.isDockerInstalled;
  });

  it("returns true when docker binary is in PATH", () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("Docker version 24.0.0"));
    expect(isDockerInstalled()).toBe(true);
  });

  it("returns false when docker binary is not found", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("command not found");
    });
    expect(isDockerInstalled()).toBe(false);
  });
});

describe("Docker daemon — isDaemonRunning()", () => {
  let isDaemonRunning: (customSocket: string) => Promise<boolean>;

  beforeEach(async () => {
    const mod = await import("../electron/docker");
    isDaemonRunning = mod.isDaemonRunning;
  });

  it("returns true when daemon responds to ping", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    mockPing.mockResolvedValue("OK");
    expect(await isDaemonRunning("/var/run/docker.sock")).toBe(true);
  });

  it("returns false when daemon is not responding", async () => {
    mockPing.mockRejectedValue(new Error("ECONNREFUSED"));
    MockDocker.mockImplementation(
      () => ({ ping: mockPing }) as unknown as Docker,
    );
    expect(await isDaemonRunning("")).toBe(false);
  });
});
