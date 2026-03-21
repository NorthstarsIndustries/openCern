import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/keystore.js', () => ({
  setKey: vi.fn(),
  getKey: vi.fn(),
  hasKey: vi.fn(),
  maskKey: vi.fn((k: string) => (k && k.length >= 8 ? `${k.slice(0, 6)}...${k.slice(-4)}` : '****')),
  deleteKey: vi.fn(),
}));
vi.mock('../../utils/config.js', () => ({
  config: {
    get: vi.fn(),
    set: vi.fn(),
    reset: vi.fn(),
    load: vi.fn(() => ({})),
  },
}));
vi.mock('axios');

import { setKey, getKey, hasKey, deleteKey } from '../../utils/keystore.js';
import { config } from '../../utils/config.js';
import {
  getConfigItems, setConfigValue, showConfig, resetConfig,
  getKeyStatus, setApiKey, removeApiKey,
} from '../config.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getConfigItems', () => {
  it('should return an array of config items', () => {
    const items = getConfigItems();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it('should include anthropic-key item', () => {
    const items = getConfigItems();
    const anthropicItem = items.find((i: any) => i.key === 'anthropic-key');
    expect(anthropicItem).toBeDefined();
  });

  it('should include defaultModel item', () => {
    const items = getConfigItems();
    const modelItem = items.find((i: any) => i.key === 'defaultModel');
    expect(modelItem).toBeDefined();
  });
});

describe('setConfigValue', () => {
  it('should store API keys in keystore', async () => {
    const result = await setConfigValue('anthropic-key', 'sk-ant-test123456');
    expect(result.success).toBe(true);
    expect(vi.mocked(setKey)).toHaveBeenCalled();
  });

  it('should store non-secret config via config.set', async () => {
    const result = await setConfigValue('defaultModel', 'claude-sonnet-4-6');
    expect(result.success).toBe(true);
    expect(vi.mocked(config.set)).toHaveBeenCalledWith('defaultModel', 'claude-sonnet-4-6');
  });
});

describe('showConfig', () => {
  it('should return an array of strings', () => {
    const lines = showConfig();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('resetConfig', () => {
  it('should delegate to config.reset', () => {
    resetConfig();
    expect(vi.mocked(config.reset)).toHaveBeenCalled();
  });
});

describe('getKeyStatus', () => {
  it('should return key status lines', () => {
    vi.mocked(hasKey).mockReturnValue(true);
    vi.mocked(getKey).mockReturnValue('sk-ant-abcdefghij');

    const lines = getKeyStatus();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('setApiKey', () => {
  it('should store anthropic key', () => {
    const result = setApiKey('anthropic', 'sk-ant-newkey12345');
    expect(result.success).toBe(true);
    expect(vi.mocked(setKey)).toHaveBeenCalled();
  });

  it('should store IBM quantum key', () => {
    const result = setApiKey('ibm', 'ibm-token-xyz');
    expect(result.success).toBe(true);
  });

  it('should reject unknown providers', () => {
    const result = setApiKey('unknown-provider', 'key');
    expect(result.success).toBe(false);
  });
});

describe('removeApiKey', () => {
  it('should remove anthropic key', () => {
    const result = removeApiKey('anthropic');
    expect(result.success).toBe(true);
    expect(vi.mocked(deleteKey)).toHaveBeenCalled();
  });

  it('should reject unknown providers', () => {
    const result = removeApiKey('unknown-provider');
    expect(result.success).toBe(false);
  });
});
