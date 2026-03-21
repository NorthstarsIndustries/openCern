import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({
    unref: vi.fn(),
    on: vi.fn(),
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
  })),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock('os', () => ({
  cpus: vi.fn(() => [{}]),
  homedir: vi.fn(() => '/home/test'),
  platform: vi.fn(() => 'darwin'),
}));

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import {
  isSimBuilt, isSimSourcePresent, checkBuildDeps,
  buildSim, launchSim, getSimStatus,
} from '../sim.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isSimBuilt', () => {
  it('should return true when binary exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(isSimBuilt()).toBe(true);
  });

  it('should return false when binary missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(isSimBuilt()).toBe(false);
  });
});

describe('isSimSourcePresent', () => {
  it('should return true when CMakeLists.txt exists', () => {
    vi.mocked(existsSync).mockImplementation((p: any) =>
      String(p).includes('CMakeLists.txt'),
    );
    expect(isSimSourcePresent()).toBe(true);
  });

  it('should return false when source missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(isSimSourcePresent()).toBe(false);
  });
});

describe('checkBuildDeps', () => {
  it('should detect cmake when available', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('cmake version 3.28.0'));

    const deps = checkBuildDeps();
    expect(deps.cmake).toBe(true);
  });

  it('should report cmake missing when execSync throws', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });

    const deps = checkBuildDeps();
    expect(deps.cmake).toBe(false);
  });

  it('should detect compiler availability', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('clang version 15'));

    const deps = checkBuildDeps();
    expect(deps.compiler).toBe(true);
  });
});

describe('buildSim', () => {
  it('should fail when source is not present', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = buildSim(vi.fn());
    expect(result.success).toBe(false);
  });
});

describe('launchSim', () => {
  it('should fail when binary is not built', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = launchSim('/data/events.json');
    expect(result.success).toBe(false);
  });
});

describe('getSimStatus', () => {
  it('should return status lines', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockImplementation(() => { throw new Error(); });

    const lines = getSimStatus();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});
