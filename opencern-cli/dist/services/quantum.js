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
async function client() {
    return (await getAxios()).create({ baseURL: QUANTUM_BASE, timeout: 10000 });
}
export const quantumService = {
    async getStatus() {
        try {
            const res = await (await client()).get('/health');
            return res.data;
        }
        catch {
            return { healthy: false, backend: 'unknown' };
        }
    },
    async classify(request) {
        const res = await (await client()).post('/classify', request);
        return res.data;
    },
    async getResults(jobId) {
        const res = await (await client()).get(`/results/${jobId}`);
        return res.data;
    },
    async setBackend(backend, apiKey) {
        await (await client()).post('/backend', { backend, apiKey });
    },
    async listBackends() {
        const res = await (await client()).get('/backends');
        return res.data;
    },
    async getCircuitDiagram(numQubits, layers) {
        try {
            const res = await (await client()).get('/circuit', { params: { qubits: numQubits, layers } });
            return res.data.diagram;
        }
        catch {
            // Return a simple ASCII circuit diagram as fallback
            const lines = [];
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
//# sourceMappingURL=quantum.js.map