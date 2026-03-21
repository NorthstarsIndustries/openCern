import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
// ── Inline Formatting ────────────────────────────────────
function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|__[^_]+__|~~[^~]+~~)/);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return _jsx(Text, { bold: true, children: part.slice(2, -2) }, i);
        }
        if (part.startsWith('__') && part.endsWith('__')) {
            return _jsx(Text, { bold: true, children: part.slice(2, -2) }, i);
        }
        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
            return _jsx(Text, { italic: true, children: part.slice(1, -1) }, i);
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return _jsx(Text, { color: "cyan", children: part.slice(1, -1) }, i);
        }
        if (part.startsWith('~~') && part.endsWith('~~')) {
            return _jsx(Text, { strikethrough: true, children: part.slice(2, -2) }, i);
        }
        return _jsx(Text, { children: part }, i);
    });
}
// ── Markdown Renderer ────────────────────────────────────
function renderMarkdown(text) {
    const lines = text.split('\n');
    const nodes = [];
    let inCodeBlock = false;
    let codeLines = [];
    let codeLang = '';
    let orderedListCounter = 0;
    lines.forEach((line, i) => {
        // Code block boundaries
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                // End code block
                nodes.push(_jsxs(Box, { flexDirection: "column", marginY: 0, paddingX: 1, borderStyle: "round", borderColor: "gray", children: [codeLang && (_jsx(Text, { dimColor: true, color: "gray", children: codeLang })), codeLines.map((l, j) => (_jsx(Text, { children: l }, j)))] }, `code-${i}`));
                codeLines = [];
                codeLang = '';
                inCodeBlock = false;
            }
            else {
                codeLang = line.slice(3).trim();
                inCodeBlock = true;
            }
            return;
        }
        if (inCodeBlock) {
            codeLines.push(line);
            return;
        }
        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            nodes.push(_jsx(Text, { dimColor: true, children: '─'.repeat(40) }, i));
            return;
        }
        // Headers
        if (line.startsWith('#### ')) {
            nodes.push(_jsx(Text, { bold: true, children: line.slice(5) }, i));
            return;
        }
        if (line.startsWith('### ')) {
            nodes.push(_jsx(Text, { bold: true, children: line.slice(4) }, i));
            return;
        }
        if (line.startsWith('## ')) {
            nodes.push(_jsx(Text, { bold: true, color: "blue", children: line.slice(3) }, i));
            return;
        }
        if (line.startsWith('# ')) {
            nodes.push(_jsx(Text, { bold: true, color: "blue", children: line.slice(2) }, i));
            return;
        }
        // Blockquote
        if (line.startsWith('> ')) {
            nodes.push(_jsxs(Box, { flexDirection: "row", children: [_jsxs(Text, { color: "gray", children: ['\u2502', " "] }), _jsx(Text, { italic: true, children: renderInline(line.slice(2)) })] }, i));
            return;
        }
        // Ordered list
        const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
        if (orderedMatch) {
            const indent = orderedMatch[1];
            const content = orderedMatch[3];
            orderedListCounter++;
            nodes.push(_jsxs(Text, { children: [indent, "  ", orderedListCounter, ". ", renderInline(content)] }, i));
            return;
        }
        else {
            orderedListCounter = 0;
        }
        // Unordered list
        if (line.match(/^\s*[-*+]\s/)) {
            const indent = line.match(/^(\s*)/)?.[1] || '';
            const content = line.replace(/^\s*[-*+]\s/, '');
            nodes.push(_jsxs(Text, { children: [indent, "  - ", renderInline(content)] }, i));
            return;
        }
        // Table detection (simple pipe table)
        if (line.includes('|') && line.trim().startsWith('|')) {
            const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
            // Skip separator rows
            if (cells.every(c => /^[-:]+$/.test(c))) {
                nodes.push(_jsx(Text, { dimColor: true, children: '─'.repeat(40) }, i));
                return;
            }
            nodes.push(_jsx(Box, { flexDirection: "row", gap: 2, children: cells.map((cell, ci) => (_jsx(Text, { children: renderInline(cell) }, ci))) }, i));
            return;
        }
        // Regular paragraph
        nodes.push(_jsx(Text, { children: renderInline(line) }, i));
    });
    // Unclosed code block
    if (inCodeBlock && codeLines.length) {
        nodes.push(_jsxs(Box, { flexDirection: "column", marginY: 0, paddingX: 1, borderStyle: "round", borderColor: "gray", children: [codeLang && _jsx(Text, { dimColor: true, color: "gray", children: codeLang }), codeLines.map((l, j) => (_jsx(Text, { children: l }, j)))] }, "code-end"));
    }
    return nodes;
}
// ── Spinner ──────────────────────────────────────────────
const SPINNER_FRAMES = ['\u2807', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];
function StreamSpinner() {
    const [frame, setFrame] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setFrame(f => (f + 1) % SPINNER_FRAMES.length);
        }, 150);
        return () => clearInterval(interval);
    }, []);
    return _jsx(Text, { color: "blue", children: SPINNER_FRAMES[frame] });
}
// ── Tool Approval Card ───────────────────────────────────
function ToolApprovalCard({ toolCall, onApprove, onDeny }) {
    useInput((_input, key) => {
        if (key.return && onApprove)
            onApprove();
        if (key.escape && onDeny)
            onDeny();
    });
    const toolLabel = toolCall.name === 'execute_python' ? 'Python'
        : toolCall.name === 'execute_bash' ? 'Bash'
            : 'OpenCERN CLI';
    const codeLines = (toolCall.displayCode || '').split('\n');
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, paddingX: 1, borderStyle: "round", borderColor: "yellow", children: [_jsxs(Box, { flexDirection: "row", gap: 2, children: [_jsxs(Text, { bold: true, color: "yellow", children: ["[tool] ", toolLabel] }), toolCall.resourceWarning && (_jsxs(Text, { dimColor: true, color: "yellow", children: ["[~] ", toolCall.resourceWarning] }))] }), _jsxs(Box, { flexDirection: "column", marginY: 0, paddingLeft: 1, borderStyle: "round", borderColor: "gray", marginTop: 1, paddingX: 1, children: [codeLines.slice(0, 15).map((line, i) => (_jsx(Text, { dimColor: true, children: line }, i))), codeLines.length > 15 && (_jsxs(Text, { dimColor: true, children: ["... ", codeLines.length - 15, " more lines"] }))] }), _jsxs(Box, { gap: 2, marginTop: 1, children: [_jsx(Text, { dimColor: true, children: "Press " }), _jsx(Text, { bold: true, color: "green", children: "Enter" }), _jsx(Text, { dimColor: true, children: " to run, " }), _jsx(Text, { bold: true, color: "red", children: "Esc" }), _jsx(Text, { dimColor: true, children: " to skip" })] })] }));
}
// ── Tool Result Card ─────────────────────────────────────
function ToolResultCard({ result }) {
    const statusIcon = result.success ? '[+]' : '[-]';
    const statusColor = result.success ? 'green' : 'red';
    const durationStr = result.duration ? ` ${result.duration}ms` : '';
    return (_jsxs(Box, { flexDirection: "column", marginY: 0, paddingX: 1, children: [_jsxs(Box, { gap: 1, children: [_jsx(Text, { color: statusColor, bold: true, children: statusIcon }), _jsxs(Text, { dimColor: true, children: ["result", durationStr] })] }), result.output && (_jsxs(Box, { flexDirection: "column", paddingLeft: 2, marginY: 0, children: [result.output.split('\n').slice(0, 20).map((line, i) => (_jsx(Text, { dimColor: true, children: line }, i))), result.output.split('\n').length > 20 && (_jsxs(Text, { dimColor: true, children: ["... (", result.output.split('\n').length - 20, " more lines)"] }))] }))] }));
}
// ── Main Component ───────────────────────────────────────
export function AIStream({ tokens, isStreaming, onCancel, model, tokenCount, latency, pendingTool, toolResults, onApprove, onDeny, thinkingText, }) {
    useInput((_input, key) => {
        if (key.escape && isStreaming && onCancel) {
            onCancel();
        }
    });
    const renderedMarkdown = useMemo(() => renderMarkdown(tokens), [tokens]);
    const modelShort = model?.replace('claude-', '').replace(/-\d{8}$/, '') || '';
    const tokensPerSec = latency && tokenCount
        ? (tokenCount / (latency / 1000)).toFixed(0)
        : undefined;
    return (_jsxs(Box, { flexDirection: "column", paddingX: 1, children: [thinkingText && (_jsx(Box, { marginBottom: 0, flexDirection: "column", children: _jsxs(Text, { dimColor: true, children: ["[thinking] ", thinkingText] }) })), isStreaming && !pendingTool && (_jsxs(Box, { marginBottom: 0, gap: 1, children: [_jsx(StreamSpinner, {}), _jsx(Text, { dimColor: true, children: "generating..." })] })), toolResults?.map((result, i) => (_jsx(ToolResultCard, { result: result }, i))), _jsxs(Box, { flexDirection: "column", children: [renderedMarkdown, isStreaming && !pendingTool && _jsx(Text, { color: "gray", children: "_" })] }), pendingTool && (_jsx(ToolApprovalCard, { toolCall: pendingTool, onApprove: onApprove, onDeny: onDeny })), !isStreaming && tokens && (_jsxs(Box, { marginTop: 1, gap: 2, children: [model && _jsx(Text, { dimColor: true, children: modelShort }), tokenCount !== undefined && _jsxs(Text, { dimColor: true, children: [tokenCount?.toLocaleString(), " tokens"] }), latency !== undefined && _jsxs(Text, { dimColor: true, children: [(latency ? latency / 1000 : 0).toFixed(1), "s"] }), tokensPerSec && _jsxs(Text, { dimColor: true, children: [tokensPerSec, " tok/s"] })] }))] }));
}
export default React.memo(AIStream);
//# sourceMappingURL=AIStream.js.map