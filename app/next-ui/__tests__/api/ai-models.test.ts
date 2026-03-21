import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeGETRequest(searchParams: Record<string, string>): Request {
  const url = new URL("http://localhost:3000/api/ai/models");
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }
  return { url: url.toString() } as unknown as Request;
}

describe("AI Models API route — GET /api/ai/models", () => {
  let GET: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../../app/api/ai/models/route.js");
    GET = mod.GET;
  });

  it("returns model list on valid API key", async () => {
    const modelData = {
      data: [
        { id: "claude-3-7-sonnet-20250219", display_name: "Claude 3.7 Sonnet" },
        { id: "claude-3-5-haiku-20250307", display_name: "Claude 3.5 Haiku" },
      ],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(modelData),
    });

    const req = makeGETRequest({ apiKey: "sk-ant-valid" });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe("claude-3-7-sonnet-20250219");
  });

  it("returns 400 when API key is missing", async () => {
    const req = makeGETRequest({});
    const res = await GET(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toMatch(/API key/i);
  });

  it("returns error status when Anthropic rejects the key", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
    });

    const req = makeGETRequest({ apiKey: "sk-ant-invalid" });
    const res = await GET(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toMatch(/Invalid API key|failed/i);
  });

  it("forwards Anthropic headers correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [] }),
    });

    const req = makeGETRequest({ apiKey: "sk-ant-test123" });
    await GET(req);

    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe("https://api.anthropic.com/v1/models");
    expect(fetchCall[1].headers["x-api-key"]).toBe("sk-ant-test123");
    expect(fetchCall[1].headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network timeout"));

    const req = makeGETRequest({ apiKey: "sk-ant-valid" });
    const res = await GET(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toMatch(/Network timeout/);
  });
});
