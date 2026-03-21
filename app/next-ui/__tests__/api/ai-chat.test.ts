import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRequest(body: Record<string, unknown>): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = events.map((e) => `data: ${e}\n\n`).join("");
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

describe("AI Chat API route — POST /api/ai/chat", () => {
  let POST: (request: Request) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import("../../app/api/ai/chat/route.js");
    POST = mod.POST;
  });

  it("returns 400 when no API key is provided", async () => {
    const req = makeRequest({ messages: [{ role: "user", content: "hello" }] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/API key/i);
  });

  it("returns 400 when no messages are provided", async () => {
    const req = makeRequest({ apiKey: "sk-ant-test", messages: [] });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/messages/i);
  });

  it("returns streaming response on success", async () => {
    const events = [
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "Hello" } }),
      JSON.stringify({ type: "message_stop" }),
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      body: sseStream(events),
    });

    const req = makeRequest({
      apiKey: "sk-ant-test",
      messages: [{ role: "user", content: "hi" }],
      model: "claude-3-7-sonnet-20250219",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("forwards tool definitions including execute_python and execute_bash", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: sseStream([JSON.stringify({ type: "message_stop" })]),
    });

    const req = makeRequest({
      apiKey: "sk-ant-test",
      messages: [{ role: "user", content: "run code" }],
    });

    await POST(req);

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    const toolNames = body.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("execute_python");
    expect(toolNames).toContain("execute_bash");
  });

  it("streams tool_use events to the client", async () => {
    const events = [
      JSON.stringify({
        type: "content_block_start",
        content_block: { type: "tool_use", id: "tu_1", name: "execute_python" },
      }),
      JSON.stringify({
        type: "content_block_delta",
        delta: { type: "input_json_delta", partial_json: '{"code":"print(1)"}' },
      }),
      JSON.stringify({ type: "content_block_stop" }),
      JSON.stringify({ type: "message_stop" }),
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      body: sseStream(events),
    });

    const req = makeRequest({
      apiKey: "sk-ant-test",
      messages: [{ role: "user", content: "run python" }],
    });

    const res = await POST(req);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let output = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value);
    }

    expect(output).toContain('"type":"tool_use"');
    expect(output).toContain("execute_python");
  });

  it("returns error status on Anthropic 401", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: { message: "invalid key" } })),
    });

    const req = makeRequest({
      apiKey: "sk-ant-bad",
      messages: [{ role: "user", content: "hello" }],
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/API key/i);
  });

  it("returns error status on Anthropic 429", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue("{}"),
    });

    const req = makeRequest({
      apiKey: "sk-ant-test",
      messages: [{ role: "user", content: "hello" }],
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toMatch(/rate limit/i);
  });
});
