import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
function renderRootMeta(content) {
    try {
        const meta = JSON.parse(content);
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { bold: true, color: "blue", children: " ROOT File Structure" }), Object.entries(meta).map(([key, val]) => (_jsxs(Box, { flexDirection: "column", marginLeft: 2, children: [_jsxs(Text, { color: "cyan", children: ["TTree: ", key] }), Array.isArray(val) && val.map((b) => (_jsxs(Text, { color: "gray", children: ["  \\\\-- ", String(b)] }, String(b))))] }, key)))] }));
    }
    catch {
        return _jsx(Text, { children: content });
    }
}
function formatSize(bytes) {
    if (bytes > 1_000_000_000)
        return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
    if (bytes > 1_000_000)
        return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes > 1_000)
        return `${(bytes / 1_000).toFixed(0)} KB`;
    return `${bytes} B`;
}
// Simple syntax coloring for different file types
function colorLine(line, fileType, searchTerm) {
    if (searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())) {
        return _jsx(Text, { backgroundColor: "yellow", color: "black", children: line });
    }
    if (fileType === 'json') {
        const keyMatch = line.match(/^(\s*)"([^"]+)":/);
        if (keyMatch) {
            return (_jsxs(Text, { children: [_jsx(Text, { color: "gray", children: line.slice(0, line.indexOf('"')) }), _jsxs(Text, { color: "yellow", children: ["\"", keyMatch[2], "\""] }), _jsx(Text, { color: "white", children: line.slice(line.indexOf(':')) })] }));
        }
        if (/:\s*-?\d+\.?\d*/.test(line))
            return _jsx(Text, { color: "magenta", children: line });
        if (/:\s*(true|false|null)/.test(line))
            return _jsx(Text, { color: "blue", children: line });
        if (line.includes(': "'))
            return _jsx(Text, { color: "green", children: line });
    }
    // Python highlighting
    if (fileType === 'text') {
        if (/^\s*(def |class |import |from |if |else|elif |for |while |return |raise |try|except|with )/.test(line)) {
            return _jsx(Text, { color: "blue", children: line });
        }
        if (/^\s*#/.test(line))
            return _jsx(Text, { color: "gray", children: line });
    }
    return _jsx(Text, { color: "white", children: line });
}
export function FilePreview({ content, filename, size, fileType = 'text', onClose, focused = true, maxHeight, }) {
    const [scrollOffset, setScrollOffset] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [searching, setSearching] = useState(false);
    const { stdout } = useStdout();
    // Dynamic visible lines based on terminal height
    const VISIBLE_LINES = maxHeight || Math.max(10, (stdout?.rows || 24) - 12);
    const lines = content.split('\n');
    const totalLines = lines.length;
    const maxOffset = Math.max(0, totalLines - VISIBLE_LINES);
    useInput((input, key) => {
        if (!focused)
            return;
        if (key.escape) {
            if (searching) {
                setSearching(false);
                setSearchTerm('');
                return;
            }
            if (onClose)
                onClose();
            return;
        }
        // Vim-style scrolling
        if (input === 'j' && !searching) {
            setScrollOffset(o => Math.min(maxOffset, o + 1));
            return;
        }
        if (input === 'k' && !searching) {
            setScrollOffset(o => Math.max(0, o - 1));
            return;
        }
        if (input === 'g' && !searching) {
            setScrollOffset(0);
            return;
        }
        if (input === 'G' && !searching) {
            setScrollOffset(maxOffset);
            return;
        }
        if (key.upArrow) {
            setScrollOffset(o => Math.max(0, o - 1));
            return;
        }
        if (key.downArrow) {
            setScrollOffset(o => Math.min(maxOffset, o + 1));
            return;
        }
        // Page up/down
        if (key.pageUp || (key.ctrl && input === 'u')) {
            setScrollOffset(o => Math.max(0, o - VISIBLE_LINES));
            return;
        }
        if (key.pageDown || (key.ctrl && input === 'd')) {
            setScrollOffset(o => Math.min(maxOffset, o + VISIBLE_LINES));
            return;
        }
        // Ctrl+F to search
        if (input === '\x06') {
            setSearching(true);
            return;
        }
        if (searching) {
            if (key.backspace || key.delete) {
                setSearchTerm(t => t.slice(0, -1));
            }
            else if (key.return) {
                // Jump to next match
                if (searchTerm) {
                    const lc = searchTerm.toLowerCase();
                    for (let i = scrollOffset + 1; i < totalLines; i++) {
                        if (lines[i].toLowerCase().includes(lc)) {
                            setScrollOffset(Math.min(i, maxOffset));
                            break;
                        }
                    }
                }
            }
            else if (input && !key.ctrl) {
                setSearchTerm(t => t + input);
            }
        }
    });
    if (fileType === 'root-meta') {
        return (_jsxs(Box, { flexDirection: "column", children: [renderRootMeta(content), _jsx(Text, { dimColor: true, children: " Esc to close" })] }));
    }
    const visibleLines = lines.slice(scrollOffset, scrollOffset + VISIBLE_LINES);
    const scrollPct = totalLines > VISIBLE_LINES
        ? Math.round((scrollOffset / maxOffset) * 100)
        : 100;
    return (_jsxs(Box, { flexDirection: "column", children: [filename && (_jsxs(Box, { paddingX: 1, marginBottom: 0, gap: 2, children: [_jsx(Text, { color: "cyan", bold: true, children: filename }), size !== undefined && _jsx(Text, { dimColor: true, children: formatSize(size) }), _jsxs(Text, { dimColor: true, children: [totalLines, " lines"] }), _jsxs(Text, { dimColor: true, children: [scrollPct, "%"] })] })), searching && (_jsxs(Box, { marginBottom: 0, paddingX: 1, children: [_jsx(Text, { color: "yellow", children: "search: " }), _jsx(Text, { children: searchTerm }), _jsx(Text, { color: "gray", dimColor: true, children: "|" }), _jsx(Text, { dimColor: true, children: " (Enter next match, Esc cancel)" })] })), _jsx(Box, { flexDirection: "column", children: visibleLines.map((line, i) => {
                    const lineNum = scrollOffset + i + 1;
                    return (_jsxs(Box, { flexDirection: "row", children: [_jsxs(Text, { color: "gray", dimColor: true, children: [String(lineNum).padStart(4), " ", '\u2502', " "] }), colorLine(line, fileType, searchTerm)] }, i));
                }) }), _jsxs(Box, { flexDirection: "row", gap: 2, marginTop: 0, paddingX: 1, children: [_jsxs(Text, { dimColor: true, children: [scrollOffset + 1, "-", Math.min(scrollOffset + VISIBLE_LINES, totalLines), "/", totalLines] }), _jsx(Text, { dimColor: true, children: "j/k scroll  Ctrl+F search  g/G top/bottom  Esc close" })] })] }));
}
export default FilePreview;
//# sourceMappingURL=FilePreview.js.map