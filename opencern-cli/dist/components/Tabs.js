import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
export function Tabs({ tabs, activeTab, onTabChange }) {
    useInput((_input, key) => {
        if (key.tab) {
            const idx = tabs.findIndex(t => t.id === activeTab);
            const next = (idx + 1) % tabs.length;
            onTabChange(tabs[next].id);
        }
    });
    return (_jsxs(Box, { flexDirection: "row", gap: 0, children: [tabs.map((tab, i) => {
                const active = tab.id === activeTab;
                return (_jsxs(Box, { flexDirection: "row", children: [i > 0 && _jsx(Text, { dimColor: true, children: " | " }), _jsx(Text, { color: active ? 'cyan' : 'gray', bold: active, underline: active, children: tab.label })] }, tab.id));
            }), _jsx(Text, { dimColor: true, children: "  (Tab to switch)" })] }));
}
export default Tabs;
//# sourceMappingURL=Tabs.js.map