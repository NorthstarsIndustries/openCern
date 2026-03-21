import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));
vi.mock('../../services/quantum.js', () => ({
  quantumService: {
    getStatus: vi.fn(),
    classify: vi.fn(),
    getResults: vi.fn(),
  },
}));
vi.mock('../../utils/config.js', () => ({
  config: {
    get: vi.fn((k: string) => {
      if (k === 'maxEvents') return 5000;
      if (k === 'quantumBackend') return 'local';
      if (k === 'quantumShots') return 1000;
      return undefined;
    }),
  },
}));
vi.mock('../../services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(() => Promise.resolve(true)),
    startContainers: vi.fn(),
  },
}));

import { readFileSync, existsSync } from 'fs';
import { quantumService } from '../../services/quantum.js';
import { docker } from '../../services/docker.js';
import { ensureQuantumRunning, extractEvents, runClassification } from '../quantum.js';

const mockedReadFile = vi.mocked(readFileSync);
const mockedExists = vi.mocked(existsSync);
const mockedQuantum = vi.mocked(quantumService);
const mockedDocker = vi.mocked(docker);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('extractEvents', () => {
  it('should extract events from { events: [...] } shape', () => {
    vi.useRealTimers();
    const data = {
      events: [
        { pt: 45.2, eta: -1.1, phi: 2.3, energy: 120, type: 'muon' },
        { pt: 30.0, eta: 0.5, phi: -1.0, energy: 80, type: 'electron' },
      ],
    };
    mockedReadFile.mockReturnValue(JSON.stringify(data));
    mockedExists.mockReturnValue(true);

    const events = extractEvents('/data/events.json');

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ pt: 45.2, eta: -1.1, phi: 2.3, energy: 120 });
  });

  it('should extract events from { particles: [...] } shape', () => {
    vi.useRealTimers();
    const data = {
      particles: [
        { pT: 50, eta: 1.0, phi: 0.5, energy: 200, type: 'photon' },
      ],
    };
    mockedReadFile.mockReturnValue(JSON.stringify(data));
    mockedExists.mockReturnValue(true);

    const events = extractEvents('/data/particles.json');

    expect(events).toHaveLength(1);
    expect(events[0].pt).toBe(50);
  });

  it('should extract events from top-level array', () => {
    vi.useRealTimers();
    const data = [
      { pt: 10, eta: 0, phi: 0, energy: 50, type: 'pion' },
    ];
    mockedReadFile.mockReturnValue(JSON.stringify(data));
    mockedExists.mockReturnValue(true);

    const events = extractEvents('/data/array.json');

    expect(events).toHaveLength(1);
  });

  it('should respect maxEvents cap', () => {
    vi.useRealTimers();
    const data = {
      events: Array.from({ length: 10_000 }, (_, i) => ({
        pt: i, eta: 0, phi: 0, energy: i * 2, type: 'muon',
      })),
    };
    mockedReadFile.mockReturnValue(JSON.stringify(data));
    mockedExists.mockReturnValue(true);

    const events = extractEvents('/data/big.json');

    expect(events.length).toBeLessThanOrEqual(5000);
  });

  it('should throw for missing file', () => {
    vi.useRealTimers();
    mockedExists.mockReturnValue(false);

    expect(() => extractEvents('/nonexistent.json')).toThrow();
  });

  it('should normalize pT to pt', () => {
    vi.useRealTimers();
    const data = { events: [{ pT: 42, eta: 1, phi: 0, energy: 100, type: 'e' }] };
    mockedReadFile.mockReturnValue(JSON.stringify(data));
    mockedExists.mockReturnValue(true);

    const events = extractEvents('/data/norm.json');
    expect(events[0].pt).toBe(42);
  });
});

describe('ensureQuantumRunning', () => {
  it('should return true immediately if quantum is healthy', async () => {
    mockedQuantum.getStatus.mockResolvedValue({ healthy: true, backend: 'local' });

    const result = await ensureQuantumRunning();

    expect(result).toBe(true);
    expect(mockedDocker.startContainers).not.toHaveBeenCalled();
  });

  it('should start containers and poll if quantum is not healthy', async () => {
    mockedQuantum.getStatus
      .mockResolvedValueOnce({ healthy: false, backend: 'unknown' })
      .mockResolvedValueOnce({ healthy: false, backend: 'unknown' })
      .mockResolvedValueOnce({ healthy: true, backend: 'local' });
    mockedDocker.startContainers.mockResolvedValue(undefined);

    const promise = ensureQuantumRunning();

    await vi.advanceTimersByTimeAsync(1100);
    await vi.advanceTimersByTimeAsync(1100);

    const result = await promise;

    expect(mockedDocker.startContainers).toHaveBeenCalledWith(true);
    expect(result).toBe(true);
  });
});

describe('runClassification', () => {
  it('should submit events and poll until complete', async () => {
    const events = [{ pt: 45, eta: 1, phi: 0.5, energy: 120, particleType: 'muon' }];
    const onStatus = vi.fn();

    mockedQuantum.classify.mockResolvedValue({ jobId: 'job-123' });
    mockedQuantum.getResults
      .mockResolvedValueOnce({ id: 'job-123', status: 'running', backend: 'local' } as any)
      .mockResolvedValueOnce({ id: 'job-123', status: 'complete', backend: 'local', results: {} } as any);

    const promise = runClassification(events, onStatus);

    await vi.advanceTimersByTimeAsync(2100);

    const job = await promise;

    expect(mockedQuantum.classify).toHaveBeenCalled();
    expect(job.status).toBe('complete');
    expect(onStatus).toHaveBeenCalled();
  });

  it('should handle classification error', async () => {
    const events = [{ pt: 10, eta: 0, phi: 0, energy: 50, particleType: 'e' }];

    mockedQuantum.classify.mockResolvedValue({ jobId: 'job-err' });
    mockedQuantum.getResults.mockResolvedValueOnce({
      id: 'job-err', status: 'error', backend: 'local', error: 'Backend unavailable',
    } as any);

    const job = await runClassification(events, vi.fn());

    expect(job.status).toBe('error');
  });
});
