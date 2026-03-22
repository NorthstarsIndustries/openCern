import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));
vi.mock('../../src/utils/config.js', () => ({
  config: {
    get: vi.fn((k: string) => {
      if (k === 'maxEvents') return 5000;
      if (k === 'quantumBackend') return 'local';
      if (k === 'quantumShots') return 1000;
      return undefined;
    }),
  },
}));

const mockGet = vi.fn();
const mockPost = vi.fn();
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({ get: mockGet, post: mockPost })),
  },
}));

vi.mock('../../src/services/docker.js', () => ({
  docker: {
    isDockerRunning: vi.fn(() => Promise.resolve(true)),
    startContainers: vi.fn(),
  },
}));

import { readFileSync, existsSync } from 'fs';
import { extractEvents, runClassification, ensureQuantumRunning } from '../../src/commands/quantum.js';
import { quantumService } from '../../src/services/quantum.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function flushAsync(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.advanceTimersByTimeAsync(0);
}

describe('quantum pipeline integration', () => {
  it('should extract events from file, classify, and get results', async () => {
    vi.useRealTimers();
    const events = [
      { pt: 45, eta: -1.1, phi: 2.3, energy: 120, type: 'muon' },
      { pt: 30, eta: 0.5, phi: -1.0, energy: 80, type: 'electron' },
      { pt: 78, eta: 1.2, phi: -2.1, energy: 310, type: 'photon' },
    ];

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ events }));

    const extracted = extractEvents('/data/events.json');
    expect(extracted).toHaveLength(3);
    expect(extracted[0].pt).toBe(45);

    mockPost.mockResolvedValueOnce({ data: { jobId: 'q-integration-1' } });
    mockGet.mockResolvedValueOnce({
      data: {
        id: 'q-integration-1', status: 'complete', backend: 'local',
        results: { signalCount: 2, backgroundCount: 1, totalEvents: 3, signalProbability: 0.67 },
      },
    });

    const job = await runClassification(extracted, vi.fn());
    expect(job.status).toBe('complete');
  });

  it('should handle quantum service not running and attempt to start it', async () => {
    mockGet
      .mockResolvedValueOnce({ data: { healthy: false, backend: 'unknown' } })
      .mockResolvedValueOnce({ data: { healthy: true, backend: 'local' } });

    const { docker } = await import('../../src/services/docker.js');
    vi.mocked(docker.startContainers).mockResolvedValue(undefined);

    const promise = ensureQuantumRunning();

    for (let i = 0; i < 5; i++) {
      await flushAsync(0);
      await flushAsync(1500);
    }

    const result = await promise;

    expect(result).toBe(true);
  });

  it('should extract events from different JSON shapes', () => {
    vi.useRealTimers();
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      particles: [{ pT: 50, eta: 1, phi: 0.5, energy: 200 }],
    }));
    const fromParticles = extractEvents('/data/particles.json');
    expect(fromParticles[0].pt).toBe(50);

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(
      [{ pt: 10, eta: 0, phi: 0, energy: 50 }],
    ));
    const fromArray = extractEvents('/data/array.json');
    expect(fromArray).toHaveLength(1);
  });

  it('should normalize alternative field names', () => {
    vi.useRealTimers();
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      events: [{
        transverse_momentum: 42, pseudorapidity: 1.5,
        azimuthal_angle: -0.7, E: 150, pdgId: '13',
      }],
    }));

    const events = extractEvents('/data/alt.json');
    expect(events[0].pt).toBe(42);
    expect(events[0].eta).toBe(1.5);
    expect(events[0].phi).toBe(-0.7);
    expect(events[0].energy).toBe(150);
  });
});
