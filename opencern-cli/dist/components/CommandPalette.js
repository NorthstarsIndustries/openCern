import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Fuse from 'fuse.js';
import { registry } from '../commands/registry.js';
const allCommands = registry.getAll();
const fuse = new Fuse(allCommands, {
    keys: ['name', 'description', 'category'],
    threshold: 0.4,
});
export function CommandPalette({ query, onSelect, onDismiss }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const filtered = query.length > 1
        ? fuse.search(query.slice(1)).map(r => r.item)
        : allCommands;
    const maxVisible = 12;
    const visible = filtered.slice(0, maxVisible);
    useInput((_input, key) => {
        if (key.escape) {
            onDismiss();
            return;
        }
        if (key.upArrow) {
            setSelectedIndex(i => Math.max(0, i - 1));
            return;
        }
        if (key.downArrow) {
            setSelectedIndex(i => Math.min(visible.length - 1, i + 1));
            return;
        }
        if (key.return || key.tab) {
            if (visible[selectedIndex])
                onSelect(visible[selectedIndex].name);
            return;
        }
    });
    if (visible.length === 0) {
        return (_jsx(Box, { borderStyle: "round", borderColor: "gray", paddingX: 1, children: _jsx(Text, { color: "gray", children: "No commands matching query" }) }));
    }
    // Group by category for display when not searching
    const showCategories = query.length <= 1;
    if (showCategories) {
        const categories = registry.getCategories();
        return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "blue", paddingX: 1, paddingY: 0, children: [_jsx(Text, { bold: true, color: "blue", children: " Command Palette" }), _jsx(Text, { dimColor: true, children: '─'.repeat(44) }), categories.map(cat => {
                    const cmds = registry.getByCategory(cat);
                    if (cmds.length === 0)
                        return null;
                    return (_jsxs(Box, { flexDirection: "column", children: [_jsxs(Text, { bold: true, dimColor: true, children: [" ", registry.getCategoryLabel(cat)] }), cmds.slice(0, 6).map(cmd => {
                                const globalIdx = allCommands.indexOf(cmd);
                                const isSelected = globalIdx === selectedIndex;
                                return (_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsxs(Text, { color: isSelected ? 'cyan' : 'white', bold: isSelected, children: [isSelected ? '>' : ' ', " ", cmd.name.padEnd(14)] }), _jsx(Text, { dimColor: true, children: cmd.description }), cmd.shortcut && _jsxs(Text, { dimColor: true, color: "gray", children: [" ", cmd.shortcut] })] }, cmd.name));
                            })] }, cat));
                }), _jsx(Text, { dimColor: true, color: "gray", children: " up/down navigate  Enter select  Esc dismiss" })] }));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "blue", paddingX: 1, children: [_jsx(Text, { bold: true, color: "blue", children: " Commands" }), visible.map((cmd, i) => (_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsxs(Text, { color: i === selectedIndex ? 'cyan' : 'white', bold: i === selectedIndex, children: [i === selectedIndex ? '>' : ' ', " ", cmd.name.padEnd(14)] }), _jsx(Text, { dimColor: true, children: cmd.description })] }, cmd.name))), filtered.length > maxVisible && (_jsxs(Text, { dimColor: true, children: [" ... ", filtered.length - maxVisible, " more"] })), _jsx(Text, { dimColor: true, color: "gray", children: " up/down navigate  Enter select  Esc dismiss" })] }));
}
export default CommandPalette;
//# sourceMappingURL=CommandPalette.js.map