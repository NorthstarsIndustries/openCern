import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text, useInput } from 'ink';
export function Modal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, destructive = false, }) {
    useInput((_input, key) => {
        if (key.return)
            onConfirm();
        if (key.escape)
            onCancel();
    });
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: destructive ? 'red' : 'blue', paddingX: 2, paddingY: 1, width: 50, children: [_jsx(Text, { bold: true, color: destructive ? 'red' : 'blue', children: title }), _jsx(Box, { marginY: 1, children: _jsx(Text, { children: message }) }), _jsxs(Box, { flexDirection: "row", gap: 2, justifyContent: "flex-end", children: [_jsxs(Text, { dimColor: true, children: ["[Esc] ", cancelLabel] }), _jsxs(Text, { color: destructive ? 'red' : 'green', bold: true, children: ["[Enter] ", confirmLabel] })] })] }));
}
export default Modal;
//# sourceMappingURL=Modal.js.map