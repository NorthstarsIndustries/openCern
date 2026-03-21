// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React from 'react';
import { Box, Text, useInput } from 'ink';

interface KeyboardShortcutsProps {
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
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

export function KeyboardShortcuts({ onClose }: KeyboardShortcutsProps): React.JSX.Element {
  useInput((_input, key) => {
    if (key.escape || _input === '?') onClose();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="blue">Keyboard Shortcuts</Text>
      <Text color="gray">────────────────────────────────────────</Text>
      {SHORTCUT_GROUPS.map(group => (
        <Box key={group.title} flexDirection="column" marginTop={1}>
          <Text bold>{group.title}</Text>
          {group.shortcuts.map(sc => (
            <Box key={sc.keys} flexDirection="row">
              <Text color="cyan">{`  ${sc.keys.padEnd(16)}`}</Text>
              <Text>{sc.description}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Press Esc or ? to close</Text>
      </Box>
    </Box>
  );
}

export default KeyboardShortcuts;
