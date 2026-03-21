import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('os', () => ({
  platform: vi.fn(() => 'darwin'),
  release: vi.fn(() => '24.0.0'),
  arch: vi.fn(() => 'arm64'),
  cpus: vi.fn(() => [{ model: 'Apple M1' }]),
  totalmem: vi.fn(() => 16 * 1024 * 1024 * 1024),
  freemem: vi.fn(() => 8 * 1024 * 1024 * 1024),
  homedir: vi.fn(() => '/home/test'),
}));
vi.mock('module', () => ({
  createRequire: vi.fn(() => vi.fn(() => ({ version: '1.0.0' }))),
}));
vi.mock('../../services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(),
    getStatus: vi.fn(),
  },
}));
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(), load: vi.fn(() => ({})) },
}));
vi.mock('../../utils/keystore.js', () => ({
  hasKey: vi.fn(),
}));
vi.mock('../../utils/auth.js', () => ({
  isAuthenticated: vi.fn(),
}));

import { execSync } from 'child_process';
import { docker } from '../../services/docker.js';
import { envInfo, versionInfo, aboutInfo } from '../system.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('envInfo', () => {
  it('should return environment information lines', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('v20.0.0'));

    const lines = envInfo();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should handle missing tools gracefully', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });

    const lines = envInfo();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('versionInfo', () => {
  it('should return version information', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('v20.0.0'));
    vi.mocked(docker.isDockerRunning).mockResolvedValue(true);
    vi.mocked(docker.getStatus).mockReturnValue({});

    const lines = await versionInfo();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('aboutInfo', () => {
  it('should return about information with project name', () => {
    const lines = aboutInfo();
    expect(Array.isArray(lines)).toBe(true);
    const text = lines.join('\n').toLowerCase();
    expect(text).toContain('opencern');
  });
});
