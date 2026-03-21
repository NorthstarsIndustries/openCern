import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
function typeIndicator(type) {
    switch (type) {
        case 'success': return '[+]';
        case 'error': return '[-]';
        case 'warning': return '[~]';
        case 'info': return '[*]';
    }
}
function typeColor(type) {
    switch (type) {
        case 'success': return 'green';
        case 'error': return 'red';
        case 'warning': return 'yellow';
        case 'info': return 'cyan';
    }
}
function ToastItem({ message, onDismiss }) {
    useEffect(() => {
        const timeout = setTimeout(() => {
            onDismiss(message.id);
        }, message.duration || 3000);
        return () => clearTimeout(timeout);
    }, [message.id, message.duration, onDismiss]);
    return (_jsxs(Box, { paddingX: 1, children: [_jsxs(Text, { color: typeColor(message.type), children: [typeIndicator(message.type), " "] }), _jsx(Text, { color: typeColor(message.type), children: message.text })] }));
}
function ToastComponent({ messages, onDismiss }) {
    if (messages.length === 0)
        return null;
    return (_jsx(Box, { flexDirection: "column", children: messages.slice(0, 3).map(msg => (_jsx(ToastItem, { message: msg, onDismiss: onDismiss }, msg.id))) }));
}
export const Toast = React.memo(ToastComponent);
// Hook for managing toast state
let toastCounter = 0;
export function useToast() {
    const [messages, setMessages] = useState([]);
    const addToast = useCallback((type, text, duration = 3000) => {
        const id = `toast-${++toastCounter}`;
        setMessages(prev => [...prev, { id, type, text, duration }]);
    }, []);
    const dismissToast = useCallback((id) => {
        setMessages(prev => prev.filter(m => m.id !== id));
    }, []);
    return { messages, addToast, dismissToast };
}
export default Toast;
//# sourceMappingURL=Toast.js.map