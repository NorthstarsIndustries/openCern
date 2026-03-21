import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getPrevious, getNext, resetCursor } from '../utils/history.js';
import { registry } from '../commands/registry.js';
export function PromptComponent({ onSubmit, disabled = false, placeholder }) {
    const [value, setValue] = useState('');
    const [completionIndex, setCompletionIndex] = useState(0);
    const inCommandMode = value.startsWith('/');
    const commandPart = value.split(' ')[0];
    const completions = inCommandMode
        ? registry.getCompletions(commandPart)
        : [];
    const showCompletions = completions.length > 0 && value.split(' ').length === 1 && commandPart.length > 1;
    const handleChange = useCallback((val) => {
        setValue(val);
        setCompletionIndex(0);
    }, []);
    const handleSubmit = useCallback((val) => {
        const trimmed = val.trim();
        if (!trimmed)
            return;
        resetCursor();
        setValue('');
        setCompletionIndex(0);
        onSubmit(trimmed);
    }, [onSubmit]);
    useInput((_input, key) => {
        if (disabled)
            return;
        if (key.upArrow) {
            if (showCompletions) {
                setCompletionIndex(i => (i - 1 + completions.length) % completions.length);
            }
            else {
                const prev = getPrevious();
                if (prev !== null)
                    setValue(prev);
            }
            return;
        }
        if (key.downArrow) {
            if (showCompletions) {
                setCompletionIndex(i => (i + 1) % completions.length);
            }
            else {
                const next = getNext();
                setValue(next ?? '');
            }
            return;
        }
        if (key.tab && showCompletions) {
            setValue(completions[completionIndex].name + ' ');
            return;
        }
    });
    const visibleCompletions = completions.slice(0, 8);
    // Dynamic height: 3 when no completions, grows with completions
    const minH = showCompletions ? 3 + visibleCompletions.length + 2 : 3;
    return (_jsxs(Box, { flexDirection: "column", width: "100%", minHeight: minH, justifyContent: "flex-end", children: [showCompletions && (_jsxs(Box, { flexDirection: "column", marginBottom: 0, paddingX: 1, children: [visibleCompletions.map((cmd, i) => {
                        const selected = i === completionIndex;
                        return (_jsxs(Box, { flexDirection: "row", gap: 1, children: [selected ? _jsx(Text, { bold: true, color: "cyan", children: '>' }) : _jsx(Text, { children: " " }), selected ? (_jsx(Text, { color: "cyan", bold: true, children: cmd.name.padEnd(14) })) : (_jsx(Text, { children: cmd.name.padEnd(14) })), _jsx(Text, { dimColor: !selected, children: cmd.description }), cmd.shortcut && _jsxs(Text, { dimColor: true, color: "gray", children: [" (", cmd.shortcut, ")"] })] }, cmd.name));
                    }), completions.length > 8 && (_jsxs(Text, { dimColor: true, children: ["  ... ", completions.length - 8, " more"] }))] })), _jsxs(Box, { flexDirection: "row", alignItems: "center", children: [_jsxs(Text, { bold: true, color: "cyan", children: ["opencern ", '>', " "] }), disabled ? (_jsx(Text, { dimColor: true, italic: true, children: placeholder || 'Processing...' })) : (_jsx(TextInput, { value: value, onChange: handleChange, onSubmit: handleSubmit, placeholder: placeholder || 'Ask anything or type / for commands...' }))] })] }));
}
export const Prompt = React.memo(PromptComponent);
export default Prompt;
//# sourceMappingURL=Prompt.js.map