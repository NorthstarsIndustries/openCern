import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(() => ''),
  spawn: vi.fn(),
  execFile: vi.fn((_cmd: string, _args: string[], cb: Function) => {
    cb(null, '', '');
  }),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test'),
}));
vi.mock('axios');
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(() => 'http://localhost:8080') },
}));

import { execSync, execFile } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import axios from 'axios';
import { docker } from '../docker.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(execSync).mockReturnValue('');
  vi.mocked(existsSync).mockReturnValue(true);
});

describe('docker.isDockerRunning', () => {
  it('should return true when docker info succeeds', async () => {
    vi.mocked(execFile).mockImplementation((_cmd: any, _args: any, cb: any) => {
      cb(null, '', '');
      return {} as any;
    });

    const result = await docker.isDockerRunning();
    expect(result).toBe(true);
  });

  it('should return false when docker info fails', async () => {
    vi.mocked(execFile).mockImplementation((_cmd: any, _args: any, cb: any) => {
      cb(new Error('Cannot connect to Docker daemon'), '', '');
      return {} as any;
    });

    const result = await docker.isDockerRunning();
    expect(result).toBe(false);
  });
});

describe('docker.isApiReady', () => {
  it('should return true when health endpoint responds', async () => {
    vi.mocked(axios.get).mockResolvedValue({ status: 200 });

    const ready = await docker.isApiReady();
    expect(ready).toBe(true);
  });

  it('should return false when health endpoint fails', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('ECONNREFUSED'));

    const ready = await docker.isApiReady();
    expect(ready).toBe(false);
  });
});

describe('docker.isQuantumReady', () => {
  it('should return true when quantum health responds', async () => {
    vi.mocked(axios.get).mockResolvedValue({ status: 200 });

    const ready = await docker.isQuantumReady();
    expect(ready).toBe(true);
  });

  it('should return false when quantum is down', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('ECONNREFUSED'));

    const ready = await docker.isQuantumReady();
    expect(ready).toBe(false);
  });
});

describe('docker.getStatus', () => {
  it('should return container status map', () => {
    vi.mocked(execSync).mockReturnValue(
      'opencern-api  Up 5 minutes\nopencern-streamer  Up 5 minutes',
    );

    const status = docker.getStatus();
    expect(typeof status).toBe('object');
  });
});

describe('docker.ensureComposeFile', () => {
  it('should write compose file without quantum by default', () => {
    docker.ensureComposeFile(false);

    expect(vi.mocked(writeFileSync)).toHaveBeenCalled();
    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('api');
    expect(written).toContain('streamer');
  });

  it('should include quantum service when requested', () => {
    docker.ensureComposeFile(true);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('quantum');
  });
});

describe('docker.getLogs', () => {
  it('should return log output for a service', () => {
    vi.mocked(execSync).mockReturnValue('Starting server...\nListening on :8080');

    const logs = docker.getLogs('api');
    expect(typeof logs).toBe('string');
  });
});

describe('docker.getLocalDigest', () => {
  it('should return null on failure', () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error(); });

    const digest = docker.getLocalDigest('ghcr.io/ceoatnorthstar/api:latest');
    expect(digest).toBeNull();
  });
});

describe('docker.getRemoteDigest', () => {
  it('should return null on failure', async () => {
    vi.mocked(execSync).mockImplementation(() => { throw new Error(); });

    const digest = await docker.getRemoteDigest('ghcr.io/ceoatnorthstar/api:latest');
    expect(digest).toBeNull();
  });
});

describe('docker.startContainers', () => {
  it('should run docker compose up', async () => {
    vi.mocked(execSync).mockReturnValue('');

    await docker.startContainers();

    expect(vi.mocked(execSync)).toHaveBeenCalled();
  });
});

describe('docker.stopContainers', () => {
  it('should run docker compose down', async () => {
    vi.mocked(execSync).mockReturnValue('');

    await docker.stopContainers();

    expect(vi.mocked(execSync)).toHaveBeenCalled();
  });
});
