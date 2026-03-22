/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */

// Lazy-load axios to avoid follow-redirects initialization issues with Bun
const getAxios = () => import('axios').then(m => m.default);

const QUANTUM_BASE = 'http://localhost:8082';

export interface QuantumEvent {
  pt: number;
  eta: number;
  phi: number;
  energy: number;
  particleType?: string;
}

export interface ClassifyRequest {
  events: QuantumEvent[];
  backend?: 'local' | 'ibm' | 'braket';
  shots?: number;
}

export interface QuantumJob {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  backend: string;
  queuePosition?: number;
  estimatedWait?: number;
  results?: QuantumResults;
  error?: string;
}

export interface QuantumResults {
  signalCount: number;
  backgroundCount: number;
  totalEvents: number;
  signalProbability: number;
  fidelity: number;
  shotsCompleted: number;
  circuitDiagram: string;
  histogram: Record<string, number>;
}

export interface BackendInfo {
  name: string;
  type: 'local' | 'ibm' | 'braket';
  qubits: number;
  available: boolean;
  queueDepth?: number;
}

async function client() {
  return (await getAxios()).create({ baseURL: QUANTUM_BASE, timeout: 10000 });
}

export const quantumService = {
  async getStatus(): Promise<{ healthy: boolean; backend: string }> {
    try {
      const res = await (await client()).get('/health');
      return res.data;
    } catch {
      return { healthy: false, backend: 'unknown' };
    }
  },

  async classify(request: ClassifyRequest): Promise<{ jobId: string }> {
    const res = await (await client()).post('/classify', request);
    return res.data;
  },

  async getResults(jobId: string): Promise<QuantumJob> {
    const res = await (await client()).get(`/results/${jobId}`);
    return res.data;
  },

  async setBackend(backend: string, apiKey?: string): Promise<void> {
    await (await client()).post('/backend', { backend, apiKey });
  },

  async listBackends(): Promise<BackendInfo[]> {
    const res = await (await client()).get('/backends');
    return res.data;
  },

  async getCircuitDiagram(numQubits: number, layers: number): Promise<string> {
    try {
      const res = await (await client()).get('/circuit', { params: { qubits: numQubits, layers } });
      return res.data.diagram;
    } catch {
      // Return a simple ASCII circuit diagram as fallback
      const lines: string[] = [];
      for (let q = 0; q < numQubits; q++) {
        let line = `q${q}: -H-Ry(th${q * 2 + 1})`;
        for (let l = 0; l < layers - 1; l++) {
          line += `-*-`;
        }
        line += `-M`;
        lines.push(line);
      }
      return lines.join('\n');
    }
  },
};

export default quantumService;
