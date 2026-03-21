import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
  readdirSync: vi.fn(),
}));
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return { ...actual };
});
vi.mock('../../services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(),
    getStatus: vi.fn(),
    isApiReady: vi.fn(),
    isQuantumReady: vi.fn(),
  },
}));
vi.mock('../../services/cern-api.js', () => ({
  cernApi: { health: vi.fn() },
}));
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(() => '/tmp/opencern-datasets') },
}));
vi.mock('../../utils/auth.js', () => ({
  isAuthenticated: vi.fn(),
}));

import { docker } from '../../services/docker.js';
import { cernApi } from '../../services/cern-api.js';
import { isAuthenticated } from '../../utils/auth.js';
import { getSystemStatus, formatStatus } from '../status.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSystemStatus', () => {
  it('should return a complete status object', async () => {
    vi.mocked(docker.isDockerRunning).mockResolvedValue(true);
    vi.mocked(docker.getStatus).mockReturnValue({
      api: { running: true, status: 'Up' },
      streamer: { running: true, status: 'Up' },
    });
    vi.mocked(docker.isApiReady).mockResolvedValue(true);
    vi.mocked(docker.isQuantumReady).mockResolvedValue(false);
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(cernApi.health).mockResolvedValue({ status: 'ok', version: '1.0' });

    const status = await getSystemStatus();

    expect(status).toHaveProperty('docker');
    expect(status).toHaveProperty('api');
    expect(status).toHaveProperty('auth');
  });

  it('should handle Docker not running', async () => {
    vi.mocked(docker.isDockerRunning).mockResolvedValue(false);
    vi.mocked(docker.getStatus).mockReturnValue({});
    vi.mocked(docker.isApiReady).mockResolvedValue(false);
    vi.mocked(docker.isQuantumReady).mockResolvedValue(false);
    vi.mocked(isAuthenticated).mockReturnValue(false);

    const status = await getSystemStatus();

    expect(status.docker).toBeDefined();
  });
});

describe('formatStatus', () => {
  it('should return formatted lines with indicators', () => {
    const status = {
      docker: true,
      containers: { api: { running: true, status: 'Up' } },
      api: true,
      quantum: false,
      auth: true,
      disk: { used: '1.2 GB', free: '50 GB' },
    };

    const lines = formatStatus(status as any);

    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l: string) => l.includes('[+]') || l.includes('[-]') || l.includes('[~]'))).toBe(true);
  });
});
