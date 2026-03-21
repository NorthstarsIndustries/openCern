// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React from 'react';
import { Box, Text, useInput } from 'ink';

interface ModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function Modal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
}: ModalProps): React.JSX.Element {
  useInput((_input, key) => {
    if (key.return) onConfirm();
    if (key.escape) onCancel();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={destructive ? 'red' : 'blue'}
      paddingX={2}
      paddingY={1}
      width={50}
    >
      <Text bold color={destructive ? 'red' : 'blue'}>{title}</Text>
      <Box marginY={1}>
        <Text>{message}</Text>
      </Box>
      <Box flexDirection="row" gap={2} justifyContent="flex-end">
        <Text dimColor>[Esc] {cancelLabel}</Text>
        <Text color={destructive ? 'red' : 'green'} bold>[Enter] {confirmLabel}</Text>
      </Box>
    </Box>
  );
}

export default Modal;
