import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: mockPost,
    })),
  },
}));

import { quantumService } from '../quantum.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('quantumService.getStatus', () => {
  it('should return healthy status', async () => {
    mockGet.mockResolvedValue({
      data: { healthy: true, backend: 'aer_simulator' },
    });

    const status = await quantumService.getStatus();
    expect(status.healthy).toBe(true);
    expect(status.backend).toBe('aer_simulator');
  });

  it('should return unhealthy on error', async () => {
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));

    const status = await quantumService.getStatus();
    expect(status.healthy).toBe(false);
  });
});

describe('quantumService.classify', () => {
  it('should submit events and return a job ID', async () => {
    mockPost.mockResolvedValue({
      data: { jobId: 'qjob-123' },
    });

    const result = await quantumService.classify({
      events: [{ pt: 45, eta: 1, phi: 0.5, energy: 120, particleType: 'muon' }],
      backend: 'local',
      shots: 1000,
    });

    expect(result.jobId).toBe('qjob-123');
  });
});

describe('quantumService.getResults', () => {
  it('should return job results', async () => {
    mockGet.mockResolvedValue({
      data: { id: 'qjob-123', status: 'complete', results: { signalCount: 42 } },
    });

    const job = await quantumService.getResults('qjob-123');
    expect(job.status).toBe('complete');
  });

  it('should return running status', async () => {
    mockGet.mockResolvedValue({
      data: { id: 'qjob-123', status: 'running' },
    });

    const job = await quantumService.getResults('qjob-123');
    expect(job.status).toBe('running');
  });
});

describe('quantumService.listBackends', () => {
  it('should return available backends', async () => {
    mockGet.mockResolvedValue({
      data: [{ name: 'aer_simulator', type: 'local', qubits: 8, available: true }],
    });

    const backends = await quantumService.listBackends();
    expect(Array.isArray(backends)).toBe(true);
    expect(backends[0].name).toBe('aer_simulator');
  });
});

describe('quantumService.setBackend', () => {
  it('should set the quantum backend', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await expect(quantumService.setBackend('aer_simulator')).resolves.toBeUndefined();
    expect(mockPost).toHaveBeenCalledWith('/backend', { backend: 'aer_simulator', apiKey: undefined });
  });

  it('should pass API key for IBM backends', async () => {
    mockPost.mockResolvedValue({ data: {} });

    await quantumService.setBackend('ibm_brisbane', 'ibm-api-key');

    expect(mockPost).toHaveBeenCalledWith('/backend', { backend: 'ibm_brisbane', apiKey: 'ibm-api-key' });
  });
});

describe('quantumService.getCircuitDiagram', () => {
  it('should return circuit diagram string', async () => {
    mockGet.mockResolvedValue({
      data: { diagram: '     ┌───┐\nq_0: ┤ H ├\n     └───┘' },
    });

    const diagram = await quantumService.getCircuitDiagram(2, 3);
    expect(typeof diagram).toBe('string');
    expect(diagram.length).toBeGreaterThan(0);
  });

  it('should return fallback on error', async () => {
    mockGet.mockRejectedValue(new Error('Service down'));

    const diagram = await quantumService.getCircuitDiagram(2, 3);
    expect(typeof diagram).toBe('string');
    expect(diagram).toContain('q0');
  });
});
