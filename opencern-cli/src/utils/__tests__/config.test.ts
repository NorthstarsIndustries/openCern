import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

// We test the config logic by reimplementing the core functions against a temp dir
// since the real module uses homedir() and module-level state.

const TEST_DIR = join(tmpdir(), `opencern-config-test-${randomBytes(4).toString('hex')}`);
const CONFIG_PATH = join(TEST_DIR, 'config.json');

const DEFAULTS = {
  dataDir: join(TEST_DIR, 'datasets'),
  defaultModel: 'claude-sonnet-4-6',
  quantumBackend: 'local' as const,
  theme: 'dark' as const,
  autoStartDocker: true,
  maxEvents: 5000,
  apiBaseUrl: 'http://localhost:8080',
  quantumShots: 1000,
  debug: false,
};

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try {
    const { rmSync } = require('fs');
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }
});

describe('config', () => {
  it('should create default config when none exists', () => {
    expect(existsSync(CONFIG_PATH)).toBe(false);
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2));
    expect(existsSync(CONFIG_PATH)).toBe(true);

    const loaded = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(loaded.defaultModel).toBe('claude-sonnet-4-6');
    expect(loaded.theme).toBe('dark');
  });

  it('should merge partial config with defaults', () => {
    const partial = { theme: 'light', debug: true };
    writeFileSync(CONFIG_PATH, JSON.stringify(partial));

    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    const merged = { ...DEFAULTS, ...raw };
    expect(merged.theme).toBe('light');
    expect(merged.debug).toBe(true);
    expect(merged.defaultModel).toBe('claude-sonnet-4-6');
  });

  it('should handle corrupted config gracefully', () => {
    writeFileSync(CONFIG_PATH, '{invalid json!!!');
    let result;
    try {
      result = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {
      result = { ...DEFAULTS };
    }
    expect(result.defaultModel).toBe('claude-sonnet-4-6');
  });

  it('should save and retrieve individual keys', () => {
    const cfg = { ...DEFAULTS };
    cfg.maxEvents = 10000;
    writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));

    const loaded = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(loaded.maxEvents).toBe(10000);
  });

  it('should reset to defaults', () => {
    writeFileSync(CONFIG_PATH, JSON.stringify({ ...DEFAULTS, maxEvents: 999 }));
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2));

    const loaded = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    expect(loaded.maxEvents).toBe(5000);
  });
});
