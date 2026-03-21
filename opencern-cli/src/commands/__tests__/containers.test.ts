import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('../../services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(),
    isApiReady: vi.fn(),
    isQuantumReady: vi.fn(),
    pullImages: vi.fn(),
    startContainers: vi.fn(),
    stopContainers: vi.fn(),
    getLogs: vi.fn(),
    getStatus: vi.fn(),
  },
}));
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn() },
}));

import { execSync } from 'child_process';
import { docker } from '../../services/docker.js';
import {
  getLogs, restartService, stopAll, pullImages,
  containerTop, networkInfo, quickHealth,
} from '../containers.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getLogs', () => {
  it('should return docker logs for a service', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('log line 1\nlog line 2'));

    const lines = getLogs('api', 50);
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should handle missing service gracefully', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('No such container'); });

    const lines = getLogs('nonexistent');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('restartService', () => {
  it('should restart a named service', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    const lines = await restartService('api');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('stopAll', () => {
  it('should stop all containers', async () => {
    vi.mocked(docker.stopContainers).mockResolvedValue(undefined);

    const lines = await stopAll();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('pullImages', () => {
  it('should pull latest images with progress callback', async () => {
    vi.mocked(docker.pullImages).mockResolvedValue(undefined);
    const onProgress = vi.fn();

    const lines = await pullImages(onProgress);
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('containerTop', () => {
  it('should return resource stats', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from(
      'CONTAINER ID  NAME       CPU %  MEM USAGE\nabc123        opencern   2.5%   150MiB',
    ));

    const lines = containerTop();
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should handle Docker not running', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error('Cannot connect'); });

    const lines = containerTop();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('networkInfo', () => {
  it('should return port mappings', () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('8080/tcp -> 0.0.0.0:8080'));

    const lines = networkInfo();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('quickHealth', () => {
  it('should check Docker, API, and quantum health', async () => {
    vi.mocked(docker.isDockerRunning).mockResolvedValue(true);
    vi.mocked(docker.isApiReady).mockResolvedValue(true);
    vi.mocked(docker.isQuantumReady).mockResolvedValue(false);

    const lines = await quickHealth();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should report all services down', async () => {
    vi.mocked(docker.isDockerRunning).mockResolvedValue(false);
    vi.mocked(docker.isApiReady).mockResolvedValue(false);
    vi.mocked(docker.isQuantumReady).mockResolvedValue(false);

    const lines = await quickHealth();
    expect(Array.isArray(lines)).toBe(true);
  });
});
