// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Fuse from 'fuse.js';
import { registry, type CommandDef } from '../commands/registry.js';

const allCommands = registry.getAll();
const fuse = new Fuse(allCommands, {
  keys: ['name', 'description', 'category'],
  threshold: 0.4,
});

interface CommandPaletteProps {
  query: string;
  onSelect: (command: string) => void;
  onDismiss: () => void;
}

export function CommandPalette({ query, onSelect, onDismiss }: CommandPaletteProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = query.length > 1
    ? fuse.search(query.slice(1)).map(r => r.item)
    : allCommands;

  const maxVisible = 12;
  const visible = filtered.slice(0, maxVisible);

  useInput((_input, key) => {
    if (key.escape) { onDismiss(); return; }
    if (key.upArrow) { setSelectedIndex(i => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setSelectedIndex(i => Math.min(visible.length - 1, i + 1)); return; }
    if (key.return || key.tab) {
      if (visible[selectedIndex]) onSelect(visible[selectedIndex].name);
      return;
    }
  });

  if (visible.length === 0) {
    return (
      <Box borderStyle="round" borderColor="gray" paddingX={1}>
        <Text color="gray">No commands matching query</Text>
      </Box>
    );
  }

  // Group by category for display when not searching
  const showCategories = query.length <= 1;

  if (showCategories) {
    const categories = registry.getCategories();
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} paddingY={0}>
        <Text bold color="blue"> Command Palette</Text>
        <Text dimColor>{'─'.repeat(44)}</Text>
        {categories.map(cat => {
          const cmds = registry.getByCategory(cat);
          if (cmds.length === 0) return null;
          return (
            <Box key={cat} flexDirection="column">
              <Text bold dimColor> {registry.getCategoryLabel(cat)}</Text>
              {cmds.slice(0, 6).map(cmd => {
                const globalIdx = allCommands.indexOf(cmd);
                const isSelected = globalIdx === selectedIndex;
                return (
                  <Box key={cmd.name} flexDirection="row" gap={1}>
                    <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
                      {isSelected ? '>' : ' '} {cmd.name.padEnd(14)}
                    </Text>
                    <Text dimColor>{cmd.description}</Text>
                    {cmd.shortcut && <Text dimColor color="gray"> {cmd.shortcut}</Text>}
                  </Box>
                );
              })}
            </Box>
          );
        })}
        <Text dimColor color="gray"> up/down navigate  Enter select  Esc dismiss</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      <Text bold color="blue"> Commands</Text>
      {visible.map((cmd, i) => (
        <Box key={cmd.name} flexDirection="row" gap={1}>
          <Text color={i === selectedIndex ? 'cyan' : 'white'} bold={i === selectedIndex}>
            {i === selectedIndex ? '>' : ' '} {cmd.name.padEnd(14)}
          </Text>
          <Text dimColor>{cmd.description}</Text>
        </Box>
      ))}
      {filtered.length > maxVisible && (
        <Text dimColor> ... {filtered.length - maxVisible} more</Text>
      )}
      <Text dimColor color="gray"> up/down navigate  Enter select  Esc dismiss</Text>
    </Box>
  );
}

export default CommandPalette;
