import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExec = vi.fn();
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockRmSync = vi.fn();

vi.mock("child_process", () => ({
  exec: (...args: unknown[]) => {
    const cb = args[args.length - 1];
    if (typeof cb === "function") {
      return mockExec(...args);
    }
    return mockExec(...args);
  },
}));

vi.mock("util", () => ({
  promisify: () => mockExec,
}));

vi.mock("fs", () => ({
  default: {
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    rmSync: (...args: unknown[]) => mockRmSync(...args),
  },
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  rmSync: (...args: unknown[]) => mockRmSync(...args),
}));

function makeRequest(body: Record<string, unknown>): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("AI Execute API route — POST /api/ai/execute", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockExistsSync.mockReturnValue(false);
    const mod = await import("../../app/api/ai/execute/route.js");
    POST = mod.POST;
  });

  it("returns 400 when toolName is missing", async () => {
    const req = makeRequest({ toolInput: { code: "print(1)" } });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing/);
  });

  it("returns 400 when toolInput is missing", async () => {
    const req = makeRequest({ toolName: "execute_python" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  describe("bash blocklist enforcement", () => {
    const blockedCommands = ["rm -rf /", "mkfs.ext4 /dev/sda", "dd if=/dev/zero"];

    for (const cmd of blockedCommands) {
      it(`blocks dangerous command: ${cmd}`, async () => {
        const req = makeRequest({ toolName: "execute_bash", toolInput: { command: cmd } });
        const res = await POST(req);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toMatch(/blocked/i);
      });
    }

    it("allows safe bash commands", async () => {
      mockExec.mockResolvedValue({ stdout: "hello\n", stderr: "" });
      const req = makeRequest({ toolName: "execute_bash", toolInput: { command: "echo hello" } });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe("Python execution", () => {
    it("executes python code and returns output", async () => {
      mockExec.mockResolvedValue({ stdout: "42\n", stderr: "" });
      const req = makeRequest({
        toolName: "execute_python",
        toolInput: { code: "print(42)" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.output).toContain("42");
    });

    it("returns 400 when python code is missing", async () => {
      const req = makeRequest({
        toolName: "execute_python",
        toolInput: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Missing python code/);
    });

    it("handles python execution errors", async () => {
      mockExec.mockRejectedValue({
        stdout: "",
        stderr: "NameError: name 'x' is not defined",
        message: "Process exited with code 1",
      });

      const req = makeRequest({
        toolName: "execute_python",
        toolInput: { code: "print(x)" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe("timeout handling", () => {
    it("passes 60s timeout to exec", async () => {
      mockExec.mockResolvedValue({ stdout: "done", stderr: "" });
      const req = makeRequest({
        toolName: "execute_bash",
        toolInput: { command: "sleep 1" },
      });
      await POST(req);
      const execCall = mockExec.mock.calls[0];
      expect(execCall[1]).toEqual(expect.objectContaining({ timeout: 60000 }));
    });
  });

  describe("unknown tool", () => {
    it("returns 400 for unknown tool name", async () => {
      const req = makeRequest({
        toolName: "execute_ruby",
        toolInput: { code: "puts 1" },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/Unknown tool/);
    });
  });

  describe("opencern_cli tool", () => {
    it("returns stub response for CLI commands", async () => {
      const req = makeRequest({
        toolName: "opencern_cli",
        toolInput: { args: "ask what is a higgs boson" },
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.output).toContain("opencern");
    });
  });
});
