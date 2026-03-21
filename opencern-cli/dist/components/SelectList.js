import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
export function SelectList({ items, onSelect, onCancel, title, multiSelect = false, maxVisible = 10, searchable = true, }) {
    const [cursor, setCursor] = useState(0);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [selected, setSelected] = useState(new Set());
    const [filter, setFilter] = useState('');
    const filtered = filter
        ? items.filter(it => it.label.toLowerCase().includes(filter.toLowerCase()) ||
            it.value.toLowerCase().includes(filter.toLowerCase()))
        : items;
    const visible = filtered.slice(scrollOffset, scrollOffset + maxVisible);
    useInput((input, key) => {
        if (key.escape) {
            if (filter) {
                setFilter('');
                setCursor(0);
                setScrollOffset(0);
            }
            else {
                onCancel?.();
            }
            return;
        }
        if (key.upArrow) {
            if (cursor > 0) {
                setCursor(c => c - 1);
                if (cursor - 1 < scrollOffset)
                    setScrollOffset(o => Math.max(0, o - 1));
            }
            return;
        }
        if (key.downArrow) {
            if (cursor < filtered.length - 1) {
                setCursor(c => c + 1);
                if (cursor + 1 >= scrollOffset + maxVisible)
                    setScrollOffset(o => o + 1);
            }
            return;
        }
        if (key.return) {
            if (multiSelect && selected.size > 0) {
                // Return first selected item — caller can check the set
                const first = items.find(it => selected.has(it.value));
                if (first)
                    onSelect(first);
            }
            else if (filtered[cursor]) {
                onSelect(filtered[cursor]);
            }
            return;
        }
        if (input === ' ' && multiSelect) {
            const item = filtered[cursor];
            if (item) {
                setSelected(prev => {
                    const next = new Set(prev);
                    if (next.has(item.value))
                        next.delete(item.value);
                    else
                        next.add(item.value);
                    return next;
                });
            }
            return;
        }
        if (searchable && input && !key.ctrl && !key.meta) {
            if (key.backspace || key.delete) {
                setFilter(f => f.slice(0, -1));
            }
            else {
                setFilter(f => f + input);
            }
            setCursor(0);
            setScrollOffset(0);
        }
    });
    return (_jsxs(Box, { flexDirection: "column", children: [title && _jsx(Text, { bold: true, color: "blue", children: title }), searchable && filter && (_jsxs(Box, { children: [_jsx(Text, { color: "yellow", children: "filter: " }), _jsx(Text, { children: filter })] })), visible.map((item, i) => {
                const absIdx = i + scrollOffset;
                const isCursor = absIdx === cursor;
                const isSelected = selected.has(item.value);
                const prefix = multiSelect
                    ? (isSelected ? '[x]' : '[ ]')
                    : (isCursor ? ' > ' : '   ');
                return (_jsxs(Box, { flexDirection: "row", gap: 1, children: [_jsxs(Text, { color: isCursor ? 'cyan' : 'white', bold: isCursor, children: [prefix, " ", item.label] }), item.description && _jsx(Text, { dimColor: true, children: item.description })] }, item.value));
            }), filtered.length > maxVisible && (_jsxs(Text, { dimColor: true, children: [scrollOffset + 1, "-", Math.min(scrollOffset + maxVisible, filtered.length), " of ", filtered.length] })), _jsx(Text, { dimColor: true, color: "gray", children: multiSelect ? 'Space toggle, Enter confirm, Esc cancel' : 'Enter select, Esc cancel' })] }));
}
export default SelectList;
//# sourceMappingURL=SelectList.js.map