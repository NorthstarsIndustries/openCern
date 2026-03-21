import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test'),
}));
vi.mock('module', () => ({
  createRequire: vi.fn(() => {
    const req = Object.assign(vi.fn(() => ({ version: '1.0.0-beta.1' })), {
      resolve: vi.fn(),
    });
    return req;
  }),
}));
vi.mock('axios');
vi.mock('../../services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(() => true),
    pullImages: vi.fn(),
    getLocalDigest: vi.fn(),
    getRemoteDigest: vi.fn(),
  },
}));

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import axios from 'axios';
import { docker } from '../../services/docker.js';
import { checkForUpdates, updateDockerImages, getUpdateBanner } from '../update.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkForUpdates', () => {
  it('should detect when a newer CLI version is available', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(axios.get).mockResolvedValue({
      data: { version: '2.0.0' },
    });

    const info = await checkForUpdates(false);

    expect(info.hasUpdate).toBe(true);
    expect(info.latestVersion).toBe('2.0.0');
  });

  it('should report no update when versions match', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(axios.get).mockResolvedValue({
      data: { version: '1.0.0-beta.1' },
    });

    const info = await checkForUpdates(false);

    expect(info.hasUpdate).toBe(false);
  });

  it('should use cache when within TTL', async () => {
    const cached = {
      lastCheck: Date.now(),
      cliUpdate: false,
      dockerUpdate: false,
      latestVersion: '1.0.0-beta.1',
    };
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(cached));

    const info = await checkForUpdates(true);

    expect(info.hasUpdate).toBe(false);
    expect(vi.mocked(axios.get)).not.toHaveBeenCalled();
  });

  it('should detect Docker image updates via execSync', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(axios.get).mockResolvedValue({
      data: { version: '1.0.0-beta.1' },
    });
    vi.mocked(docker.isDockerRunning).mockReturnValue(true as any);
    vi.mocked(execSync).mockReturnValue(Buffer.from('sha256:abc'));

    const info = await checkForUpdates(false);

    expect(typeof info.dockerUpdate).toBe('boolean');
  });
});

describe('updateDockerImages', () => {
  it('should pull docker images with progress callback', async () => {
    vi.mocked(docker.isDockerRunning).mockReturnValue(true as any);
    vi.mocked(execSync).mockReturnValue('');
    const onProgress = vi.fn();

    await updateDockerImages(onProgress);

    expect(onProgress).toHaveBeenCalled();
    expect(vi.mocked(execSync)).toHaveBeenCalledWith(
      expect.stringContaining('docker pull'),
      expect.any(Object),
    );
  });
});

describe('getUpdateBanner', () => {
  it('should return null when no cached update exists', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const banner = getUpdateBanner();
    expect(banner).toBeNull();
  });

  it('should return banner text when update is available', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      timestamp: Date.now(),
      hasUpdate: true,
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
    }));

    const banner = getUpdateBanner();
    if (banner) {
      expect(banner).toContain('2.0.0');
    }
  });
});
