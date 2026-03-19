import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
function renderHistogram(histogram) {
    const total = Object.values(histogram).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(histogram)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);
    return (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, color: "blue", children: " Measurement Histogram" }), sorted.map(([state, count]) => {
                const pct = (count / total) * 100;
                const barLen = Math.round(pct / 5);
                const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
                return (_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsxs(Text, { color: "cyan", children: ["|", state.padEnd(6), '>'] }), _jsx(Text, { color: "blue", children: bar }), _jsxs(Text, { color: "white", children: [pct.toFixed(1), "%"] })] }, state));
            })] }));
}
function renderResults(results) {
    const sigPct = results.totalEvents > 0
        ? (results.signalCount / results.totalEvents * 100).toFixed(1)
        : '0.0';
    const bgPct = results.totalEvents > 0
        ? (results.backgroundCount / results.totalEvents * 100).toFixed(1)
        : '0.0';
    const sigBarLen = Math.round(results.signalProbability * 20);
    const bgBarLen = 20 - sigBarLen;
    return (_jsxs(Box, { flexDirection: "column", gap: 0, marginTop: 1, children: [_jsx(Text, { bold: true, color: "blue", children: " Classification Results" }), _jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: "green", children: "Signal:    " }), _jsxs(Text, { children: [results.signalCount, "/", results.totalEvents, " (", sigPct, "%)"] }), _jsx(Text, { color: "green", children: '█'.repeat(sigBarLen) }), _jsxs(Text, { color: "cyan", children: [(results.signalProbability * 100).toFixed(1), "% confidence"] })] }), _jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsx(Text, { color: "red", children: "Background:" }), _jsxs(Text, { children: [results.backgroundCount, "/", results.totalEvents, " (", bgPct, "%)"] }), _jsx(Text, { color: "red", children: '█'.repeat(bgBarLen) })] }), _jsxs(Box, { flexDirection: "row", gap: 2, marginTop: 0, children: [_jsxs(Text, { color: "gray", children: ["Fidelity: ", _jsx(Text, { color: "white", children: results.fidelity.toFixed(3) })] }), _jsxs(Text, { color: "gray", children: ["Shots: ", _jsx(Text, { color: "white", children: results.shotsCompleted })] })] }), results.histogram && Object.keys(results.histogram).length > 0 && renderHistogram(results.histogram)] }));
}
export function QuantumPanel({ job, isRunning, backend, circuitDiagram }) {
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: "blue", paddingX: 1, gap: 0, children: [_jsxs(Box, { flexDirection: "row", gap: 2, children: [_jsx(Text, { bold: true, color: "blue", children: "[qc] Quantum Analysis" }), _jsx(Text, { color: "gray", children: "Backend: " }), _jsx(Text, { color: "cyan", children: backend || job?.backend || 'local' }), job?.queuePosition !== undefined && job.queuePosition > 0 && (_jsxs(Text, { color: "yellow", children: [" Queue: #", job.queuePosition] }))] }), circuitDiagram && (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, color: "blue", children: " VQC Circuit" }), circuitDiagram.split('\n').map((line, i) => (_jsxs(Text, { color: "green", children: ["  ", line] }, i)))] })), isRunning && !job?.results && (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "blue", children: _jsx(Spinner, { type: "dots" }) }), _jsx(Text, { color: "gray", children: "  Running quantum circuit..." }), job?.status && _jsxs(Text, { color: "gray", dimColor: true, children: ["  (", job.status, ")"] })] })), job?.error && (_jsx(Box, { marginTop: 1, children: _jsxs(Text, { color: "red", children: ["[-] Error: ", job.error] }) })), job?.results && renderResults(job.results)] }));
}
export default QuantumPanel;
//# sourceMappingURL=QuantumPanel.js.map