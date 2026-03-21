import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
const SHORTCUT_GROUPS = [
    {
        title: 'Navigation',
        shortcuts: [
            { keys: 'Ctrl+D', description: 'Exit' },
            { keys: 'Ctrl+L', description: 'Clear screen' },
            { keys: 'Ctrl+K', description: 'Command palette' },
            { keys: '?', description: 'Show shortcuts (this screen)' },
            { keys: 'Esc', description: 'Cancel / dismiss / go back' },
        ],
    },
    {
        title: 'Prompt',
        shortcuts: [
            { keys: 'Tab', description: 'Autocomplete command' },
            { keys: 'Up/Down', description: 'History / navigate completions' },
            { keys: 'Enter', description: 'Submit / approve tool' },
        ],
    },
    {
        title: 'File Preview',
        shortcuts: [
            { keys: 'Up/Down', description: 'Scroll content' },
            { keys: 'Ctrl+F', description: 'Search in file' },
            { keys: 'j/k', description: 'Vim-style scroll' },
            { keys: 'Esc', description: 'Close preview' },
        ],
    },
    {
        title: 'Data Table',
        shortcuts: [
            { keys: 'Up/Down', description: 'Navigate rows' },
            { keys: 'Tab', description: 'Cycle sort column' },
            { keys: 'Enter', description: 'Select row' },
        ],
    },
    {
        title: 'AI / Agentic',
        shortcuts: [
            { keys: 'Enter', description: 'Approve tool execution' },
            { keys: 'Esc', description: 'Deny tool / cancel stream' },
        ],
    },
];
export function KeyboardShortcuts({ onClose }) {
    useInput((_input, key) => {
        if (key.escape || _input === '?')
            onClose();
    });
    return (_jsxs(Box, { flexDirection: "column", paddingX: 2, paddingY: 1, children: [_jsx(Text, { bold: true, color: "blue", children: "Keyboard Shortcuts" }), _jsx(Text, { color: "gray", children: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }), SHORTCUT_GROUPS.map(group => (_jsxs(Box, { flexDirection: "column", marginTop: 1, children: [_jsx(Text, { bold: true, children: group.title }), group.shortcuts.map(sc => (_jsxs(Box, { flexDirection: "row", children: [_jsx(Text, { color: "cyan", children: `  ${sc.keys.padEnd(16)}` }), _jsx(Text, { children: sc.description })] }, sc.keys)))] }, group.title))), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press Esc or ? to close" }) })] }));
}
export default KeyboardShortcuts;
//# sourceMappingURL=KeyboardShortcuts.js.map