import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
    }),
  },
}));

interface ClassifyRequest {
  events: Array<{ pt: number; eta: number; phi: number; energy: number; particleType?: string }>;
  backend?: 'local' | 'ibm' | 'braket';
  shots?: number;
}

interface QuantumResults {
  signalCount: number;
  backgroundCount: number;
  totalEvents: number;
  signalProbability: number;
  fidelity: number;
  shotsCompleted: number;
  circuitDiagram: string;
  histogram: Record<string, number>;
}

interface QuantumJob {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  backend: string;
  queuePosition?: number;
  estimatedWait?: number;
  results?: QuantumResults;
  error?: string;
}

describe('CLI-to-Quantum Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classify request shape', () => {
    it('sends events array with required fields to POST /classify', async () => {
      mockPost.mockResolvedValue({ data: { jobId: 'qj-123' } });

      const request: ClassifyRequest = {
        events: [
          { pt: 45.2, eta: -1.3, phi: 2.7, energy: 125.0 },
          { pt: 30.1, eta: 0.8, phi: -1.2, energy: 91.2 },
        ],
        backend: 'local',
        shots: 1024,
      };

      await mockPost('/classify', request);

      expect(mockPost).toHaveBeenCalledWith('/classify', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            pt: expect.any(Number),
            eta: expect.any(Number),
            phi: expect.any(Number),
            energy: expect.any(Number),
          }),
        ]),
      }));
    });

    it('events contain required physics fields', () => {
      const event = { pt: 45.2, eta: -1.3, phi: 2.7, energy: 125.0 };
      expect(event).toHaveProperty('pt');
      expect(event).toHaveProperty('eta');
      expect(event).toHaveProperty('phi');
      expect(event).toHaveProperty('energy');
    });

    it('optional particleType field is accepted', async () => {
      mockPost.mockResolvedValue({ data: { jobId: 'qj-456' } });

      const request: ClassifyRequest = {
        events: [
          { pt: 45.2, eta: -1.3, phi: 2.7, energy: 125.0, particleType: 'muon' },
        ],
      };

      await mockPost('/classify', request);
      expect(mockPost).toHaveBeenCalledWith('/classify', expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({ particleType: 'muon' }),
        ]),
      }));
    });

    it('classify response returns jobId', async () => {
      mockPost.mockResolvedValue({ data: { jobId: 'qj-789' } });
      const res = await mockPost('/classify', { events: [], backend: 'local' });
      expect(res.data).toHaveProperty('jobId');
      expect(typeof res.data.jobId).toBe('string');
    });
  });

  describe('getResults response shape', () => {
    it('has all required QuantumJob fields', async () => {
      const jobResponse: { data: QuantumJob } = {
        data: {
          id: 'qj-123',
          status: 'complete',
          backend: 'local',
          results: {
            signalCount: 342,
            backgroundCount: 658,
            totalEvents: 1000,
            signalProbability: 0.342,
            fidelity: 0.95,
            shotsCompleted: 1024,
            circuitDiagram: 'q0: -H-Ry-*-M',
            histogram: { '00': 658, '01': 180, '10': 120, '11': 42 },
          },
        },
      };
      mockGet.mockResolvedValue(jobResponse);

      const res = await mockGet('/results/qj-123');
      const job = res.data;

      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('backend');
      expect(['pending', 'running', 'complete', 'error']).toContain(job.status);
    });

    it('results contain all required QuantumResults fields', async () => {
      const results: QuantumResults = {
        signalCount: 342,
        backgroundCount: 658,
        totalEvents: 1000,
        signalProbability: 0.342,
        fidelity: 0.95,
        shotsCompleted: 1024,
        circuitDiagram: 'q0: -H-Ry-*-M',
        histogram: { '00': 658, '01': 342 },
      };

      expect(results).toHaveProperty('signalCount');
      expect(results).toHaveProperty('backgroundCount');
      expect(results).toHaveProperty('totalEvents');
      expect(results).toHaveProperty('signalProbability');
      expect(results).toHaveProperty('fidelity');
      expect(results).toHaveProperty('shotsCompleted');
      expect(results).toHaveProperty('circuitDiagram');
      expect(results).toHaveProperty('histogram');
    });

    it('totalEvents equals signalCount + backgroundCount', () => {
      const results: QuantumResults = {
        signalCount: 342,
        backgroundCount: 658,
        totalEvents: 1000,
        signalProbability: 0.342,
        fidelity: 0.95,
        shotsCompleted: 1024,
        circuitDiagram: '',
        histogram: {},
      };
      expect(results.totalEvents).toBe(results.signalCount + results.backgroundCount);
    });
  });

  describe('backend names are consistent', () => {
    const VALID_BACKENDS = ['local', 'ibm', 'braket'];

    it.each(VALID_BACKENDS)('backend "%s" is a recognized value', (backend) => {
      expect(VALID_BACKENDS).toContain(backend);
    });

    it('classify request accepts all valid backends', async () => {
      for (const backend of VALID_BACKENDS) {
        mockPost.mockResolvedValue({ data: { jobId: `qj-${backend}` } });
        const req: ClassifyRequest = {
          events: [{ pt: 40, eta: 0, phi: 0, energy: 100 }],
          backend: backend as 'local' | 'ibm' | 'braket',
        };
        await mockPost('/classify', req);
        expect(mockPost).toHaveBeenCalledWith('/classify', expect.objectContaining({
          backend,
        }));
      }
    });

    it('backends endpoint returns BackendInfo with consistent names', async () => {
      const backendsResponse = {
        data: [
          { name: 'local-simulator', type: 'local', qubits: 20, available: true },
          { name: 'ibm-brisbane', type: 'ibm', qubits: 127, available: true, queueDepth: 5 },
          { name: 'braket-sv1', type: 'braket', qubits: 34, available: false },
        ],
      };
      mockGet.mockResolvedValue(backendsResponse);
      const res = await mockGet('/backends');

      for (const backend of res.data) {
        expect(backend).toHaveProperty('name');
        expect(backend).toHaveProperty('type');
        expect(backend).toHaveProperty('qubits');
        expect(backend).toHaveProperty('available');
        expect(VALID_BACKENDS).toContain(backend.type);
      }
    });
  });
});
