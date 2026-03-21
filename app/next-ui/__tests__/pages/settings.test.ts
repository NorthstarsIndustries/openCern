import { describe, it, expect } from "vitest";

interface AIConfig {
  apiKey: string;
  model: string;
}

const VALID_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-haiku-3-20250307",
];

function validateApiKey(key: string): { valid: boolean; error?: string } {
  if (!key || key.trim().length === 0) {
    return { valid: false, error: "API key is required" };
  }
  if (!key.startsWith("sk-ant-")) {
    return { valid: false, error: "API key must start with sk-ant-" };
  }
  if (key.length < 20) {
    return { valid: false, error: "API key is too short" };
  }
  return { valid: true };
}

function validateModel(model: string): { valid: boolean; error?: string } {
  if (!model) {
    return { valid: false, error: "Model is required" };
  }
  if (!VALID_MODELS.includes(model)) {
    return { valid: false, error: `Unknown model: ${model}` };
  }
  return { valid: true };
}

function validateConfig(config: Partial<AIConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const keyResult = validateApiKey(config.apiKey || "");
  if (!keyResult.valid) errors.push(keyResult.error!);

  const modelResult = validateModel(config.model || "");
  if (!modelResult.valid) errors.push(modelResult.error!);

  return { valid: errors.length === 0, errors };
}

function serializeConfig(config: AIConfig): string {
  return JSON.stringify(config);
}

function deserializeConfig(json: string): AIConfig | null {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed.apiKey !== "string" || typeof parsed.model !== "string") {
      return null;
    }
    return parsed as AIConfig;
  } catch {
    return null;
  }
}

describe("Settings form validation", () => {
  describe("API key validation", () => {
    it("rejects empty API key", () => {
      const result = validateApiKey("");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/required/i);
    });

    it("rejects whitespace-only API key", () => {
      const result = validateApiKey("   ");
      expect(result.valid).toBe(false);
    });

    it("rejects API key without sk-ant- prefix", () => {
      const result = validateApiKey("invalid-key-12345678901234567890");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/sk-ant-/);
    });

    it("rejects too-short API key", () => {
      const result = validateApiKey("sk-ant-short");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/too short/i);
    });

    it("accepts valid API key", () => {
      const result = validateApiKey("sk-ant-api03-abcdefghijklmnopqrstuvwxyz");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Model validation", () => {
    it("rejects empty model", () => {
      const result = validateModel("");
      expect(result.valid).toBe(false);
    });

    it("rejects unknown model", () => {
      const result = validateModel("gpt-4-turbo");
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Unknown model/);
    });

    it("accepts valid Sonnet 4 model", () => {
      expect(validateModel("claude-sonnet-4-20250514").valid).toBe(true);
    });

    it("accepts valid Opus 4 model", () => {
      expect(validateModel("claude-opus-4-20250514").valid).toBe(true);
    });

    it("accepts valid Haiku model", () => {
      expect(validateModel("claude-haiku-3-20250307").valid).toBe(true);
    });
  });

  describe("Full config validation", () => {
    it("passes with valid config", () => {
      const result = validateConfig({
        apiKey: "sk-ant-api03-abcdefghijklmnopqrstuvwxyz",
        model: "claude-sonnet-4-20250514",
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("collects multiple errors", () => {
      const result = validateConfig({ apiKey: "", model: "" });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("handles missing fields", () => {
      const result = validateConfig({});
      expect(result.valid).toBe(false);
    });
  });
});

describe("Save config", () => {
  it("serializes config to JSON", () => {
    const config: AIConfig = {
      apiKey: "sk-ant-api03-testkey123456789",
      model: "claude-sonnet-4-20250514",
    };
    const json = serializeConfig(config);
    expect(JSON.parse(json)).toEqual(config);
  });

  it("deserializes valid JSON back to config", () => {
    const config: AIConfig = {
      apiKey: "sk-ant-api03-testkey123456789",
      model: "claude-sonnet-4-20250514",
    };
    const json = serializeConfig(config);
    const restored = deserializeConfig(json);
    expect(restored).toEqual(config);
  });

  it("returns null for invalid JSON", () => {
    expect(deserializeConfig("not json")).toBeNull();
  });

  it("returns null for malformed config", () => {
    expect(deserializeConfig(JSON.stringify({ apiKey: 123, model: true }))).toBeNull();
  });

  it("round-trips config through serialize/deserialize", () => {
    const config: AIConfig = {
      apiKey: "sk-ant-api03-round-trip-key-01234",
      model: "claude-opus-4-20250514",
    };
    const result = deserializeConfig(serializeConfig(config));
    expect(result).toEqual(config);
  });
});
