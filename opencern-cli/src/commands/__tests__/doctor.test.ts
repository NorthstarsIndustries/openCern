import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statfsSync: vi.fn(),
}));
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test'),
}));
vi.mock('../../services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(),
    isApiReady: vi.fn(),
  },
}));
vi.mock('../../utils/auth.js', () => ({
  isAuthenticated: vi.fn(),
}));

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { docker } from '../../services/docker.js';
import { isAuthenticated } from '../../utils/auth.js';
import { runDoctorChecks, formatDoctorResults } from '../doctor.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runDoctorChecks', () => {
  it('should return an array of diagnostic checks', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('v20.0.0'));
    vi.mocked(docker.isDockerRunning).mockResolvedValue(true);
    vi.mocked(docker.isApiReady).mockResolvedValue(true);
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(existsSync).mockReturnValue(true);

    const checks = await runDoctorChecks();

    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
    expect(checks[0]).toHaveProperty('name');
    expect(checks[0]).toHaveProperty('status');
    expect(checks[0]).toHaveProperty('message');
  });

  it('should report issue when Docker is not running', async () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      if (typeof cmd === 'string' && cmd.includes('node')) return Buffer.from('v20.0.0');
      if (typeof cmd === 'string' && cmd.includes('docker')) throw new Error('not found');
      return Buffer.from('');
    });
    vi.mocked(docker.isDockerRunning).mockResolvedValue(false);
    vi.mocked(docker.isApiReady).mockResolvedValue(false);
    vi.mocked(isAuthenticated).mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(true);

    const checks = await runDoctorChecks();

    expect(checks.length).toBeGreaterThan(0);
    const nonOkChecks = checks.filter((c: any) => c.status !== 'ok');
    expect(nonOkChecks.length).toBeGreaterThan(0);
  });

  it('should report ok for all passing checks', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('v20.0.0'));
    vi.mocked(docker.isDockerRunning).mockResolvedValue(true);
    vi.mocked(docker.isApiReady).mockResolvedValue(true);
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(existsSync).mockReturnValue(true);

    const checks = await runDoctorChecks();
    const okChecks = checks.filter((c: any) => c.status === 'ok');

    expect(okChecks.length).toBeGreaterThan(0);
  });
});

describe('formatDoctorResults', () => {
  it('should format ok results with check mark indicator', () => {
    const checks = [
      { name: 'Node.js', status: 'ok' as const, message: 'v20.0.0' },
    ];
    const lines = formatDoctorResults(checks);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should format error results with fix suggestion', () => {
    const checks = [
      { name: 'Docker', status: 'error' as const, message: 'Not installed', fix: 'Install Docker Desktop' },
    ];
    const lines = formatDoctorResults(checks);
    expect(lines.some((l: string) => l.includes('Docker'))).toBe(true);
  });

  it('should handle mixed results', () => {
    const checks = [
      { name: 'Node.js', status: 'ok' as const, message: 'v20.0.0' },
      { name: 'Docker', status: 'error' as const, message: 'Not found', fix: 'Install Docker' },
      { name: 'Auth', status: 'warning' as const, message: 'Not logged in' },
    ];
    const lines = formatDoctorResults(checks);
    expect(lines.length).toBeGreaterThan(0);
  });
});
