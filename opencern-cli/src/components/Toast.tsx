// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
  duration?: number;
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

function typeIndicator(type: ToastType): string {
  switch (type) {
    case 'success': return '[+]';
    case 'error': return '[-]';
    case 'warning': return '[~]';
    case 'info': return '[*]';
  }
}

function typeColor(type: ToastType): string {
  switch (type) {
    case 'success': return 'green';
    case 'error': return 'red';
    case 'warning': return 'yellow';
    case 'info': return 'cyan';
  }
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: string) => void }): React.JSX.Element {
  useEffect(() => {
    const timeout = setTimeout(() => {
      onDismiss(message.id);
    }, message.duration || 3000);
    return () => clearTimeout(timeout);
  }, [message.id, message.duration, onDismiss]);

  return (
    <Box paddingX={1}>
      <Text color={typeColor(message.type)}>{typeIndicator(message.type)} </Text>
      <Text color={typeColor(message.type)}>{message.text}</Text>
    </Box>
  );
}

function ToastComponent({ messages, onDismiss }: ToastProps): React.JSX.Element | null {
  if (messages.length === 0) return null;

  return (
    <Box flexDirection="column">
      {messages.slice(0, 3).map(msg => (
        <ToastItem key={msg.id} message={msg} onDismiss={onDismiss} />
      ))}
    </Box>
  );
}

export const Toast = React.memo(ToastComponent);

// Hook for managing toast state
let toastCounter = 0;
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: ToastType, text: string, duration = 3000) => {
    const id = `toast-${++toastCounter}`;
    setMessages(prev => [...prev, { id, type, text, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  return { messages, addToast, dismissToast };
}

export default Toast;
