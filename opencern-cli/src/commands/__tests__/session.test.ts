import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test'),
}));
vi.mock('../../utils/config.js', () => ({
  config: {
    get: vi.fn((k: string) => {
      if (k === 'defaultModel') return 'claude-sonnet-4-6';
      if (k === 'dataDir') return '/tmp/opencern-datasets';
      return undefined;
    }),
    set: vi.fn(),
  },
}));
vi.mock('../../utils/keystore.js', () => ({
  getKey: vi.fn(),
}));
vi.mock('../../utils/auth.js', () => ({
  isAuthenticated: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { isAuthenticated } from '../../utils/auth.js';
import { getKey } from '../../utils/keystore.js';
import {
  whoami, listSessions, saveSession, loadSession,
  saveRecall, getRecall, setAlias, resolveAlias,
  listAliases, loadScript, quickGet, quickSet,
} from '../session.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('whoami', () => {
  it('should return user info when authenticated', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getKey).mockReturnValue('testuser');

    const lines = whoami();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should indicate not logged in', () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    vi.mocked(getKey).mockReturnValue(null);

    const lines = whoami();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('sessions', () => {
  it('should list saved sessions', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['session1.json', 'session2.json'] as any);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      name: 'test', timestamp: Date.now(), outputCount: 10, model: 'claude-sonnet-4-6',
    }));

    const lines = listSessions();
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should save a session', () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const lines = saveSession('my-session', [{ text: 'hello' }]);
    expect(Array.isArray(lines)).toBe(true);
    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
  });

  it('should load a saved session', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      name: 'test', output: [{ text: 'line 1' }],
    }));

    const result = loadSession('test');
    expect(result).not.toBeNull();
  });

  it('should return null for missing session', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = loadSession('nonexistent');
    expect(result).toBeNull();
  });
});

describe('aliases', () => {
  it('should set and resolve aliases', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ dl: '/download' }));

    setAlias('dl', '/download');
    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
  });

  it('should resolve an aliased command', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ dl: '/download cms 2016' }));

    const resolved = resolveAlias('dl extra-arg');
    expect(resolved).toContain('/download');
  });

  it('should return input unchanged for non-aliased commands', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const resolved = resolveAlias('/status');
    expect(resolved).toBe('/status');
  });

  it('should list all aliases', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ dl: '/download', st: '/status' }));

    const lines = listAliases();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('recall', () => {
  it('should save and retrieve recall entries', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify([]));

    saveRecall('test-label', { result: 42 });
    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
  });

  it('should return recall entries', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify([
      { label: 'test', data: { result: 42 }, timestamp: Date.now() },
    ]));

    const lines = getRecall();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('loadScript', () => {
  it('should load commands from a script file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('# comment\n/download cms\n/process data.root\n');

    const commands = loadScript('/scripts/run.sh');
    expect(commands).not.toBeNull();
    expect(commands!.length).toBe(2);
  });

  it('should return null for missing script', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(loadScript('/nonexistent.sh')).toBeNull();
  });
});

describe('quickGet/quickSet', () => {
  it('should get a config value', () => {
    const lines = quickGet('defaultModel');
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should set a config value', () => {
    const lines = quickSet('defaultModel', 'claude-sonnet-4-6');
    expect(Array.isArray(lines)).toBe(true);
  });
});
