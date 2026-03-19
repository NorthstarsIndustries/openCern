import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
function formatSpeed(bytesPerSec) {
    if (bytesPerSec > 1_000_000)
        return `${(bytesPerSec / 1_000_000).toFixed(1)} MB/s`;
    if (bytesPerSec > 1_000)
        return `${(bytesPerSec / 1_000).toFixed(0)} KB/s`;
    return `${bytesPerSec} B/s`;
}
function formatEta(seconds) {
    if (seconds < 60)
        return `${Math.round(seconds)}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
function modeLabel(mode) {
    switch (mode) {
        case 'download': return 'dl';
        case 'upload': return 'up';
        case 'quantum': return 'qc';
        case 'process': return 'op';
        default: return '--';
    }
}
export function ProgressBar({ label, percent, speed, eta, mode, indeterminate = false, done = false, error = false, nested, }) {
    const [spinnerFrame, setSpinnerFrame] = useState(0);
    const { stdout } = useStdout();
    const termWidth = stdout?.columns || 80;
    useEffect(() => {
        if (done)
            return;
        const interval = setInterval(() => {
            setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length);
        }, 80);
        return () => clearInterval(interval);
    }, [done]);
    // Dynamic bar width: fill available space
    const fixedWidth = 6 + label.length + 1 + 5 + 1 + (speed !== undefined ? 12 : 0) + (eta !== undefined ? 10 : 0);
    const barWidth = Math.max(10, Math.min(40, termWidth - fixedWidth - 10));
    const filled = Math.round((Math.min(percent, 100) / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    const color = error ? 'red' : done ? 'green' : 'blue';
    const tag = modeLabel(mode);
    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsxs(Text, { color: "gray", children: ["[", tag, "]"] }), _jsx(Text, { color: done ? 'green' : error ? 'red' : 'white', children: label }), indeterminate ? (_jsx(Text, { color: color, children: SPINNER_FRAMES[spinnerFrame] })) : (_jsxs(_Fragment, { children: [_jsxs(Text, { color: color, children: ["[", bar, "]"] }), _jsxs(Text, { color: color, children: [Math.round(percent), "%"] })] })), speed !== undefined && _jsx(Text, { color: "gray", children: formatSpeed(speed) }), eta !== undefined && eta > 0 && !done && (_jsxs(Text, { color: "gray", children: ["eta ", formatEta(eta)] }))] }), nested && nested.map((n, i) => {
                const nFilled = Math.round((Math.min(n.percent, 100) / 100) * 15);
                const nBar = '\u2588'.repeat(nFilled) + '\u2591'.repeat(15 - nFilled);
                return (_jsxs(Box, { flexDirection: "row", gap: 1, paddingLeft: 2, children: [_jsx(Text, { dimColor: true, children: n.label.padEnd(20) }), _jsxs(Text, { color: n.percent >= 100 ? 'green' : 'gray', children: ["[", nBar, "] ", Math.round(n.percent), "%"] })] }, i));
            })] }));
}
export default ProgressBar;
//# sourceMappingURL=ProgressBar.js.map