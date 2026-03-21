// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getPrevious, getNext, resetCursor } from '../utils/history.js';
import { registry, type CommandDef } from '../commands/registry.js';

interface PromptProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PromptComponent({ onSubmit, disabled = false, placeholder }: PromptProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const [completionIndex, setCompletionIndex] = useState(0);

  const inCommandMode = value.startsWith('/');
  const commandPart = value.split(' ')[0];
  const completions: CommandDef[] = inCommandMode
    ? registry.getCompletions(commandPart)
    : [];
  const showCompletions = completions.length > 0 && value.split(' ').length === 1 && commandPart.length > 1;

  const handleChange = useCallback((val: string) => {
    setValue(val);
    setCompletionIndex(0);
  }, []);

  const handleSubmit = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    resetCursor();
    setValue('');
    setCompletionIndex(0);
    onSubmit(trimmed);
  }, [onSubmit]);

  useInput((_input, key) => {
    if (disabled) return;

    if (key.upArrow) {
      if (showCompletions) {
        setCompletionIndex(i => (i - 1 + completions.length) % completions.length);
      } else {
        const prev = getPrevious();
        if (prev !== null) setValue(prev);
      }
      return;
    }

    if (key.downArrow) {
      if (showCompletions) {
        setCompletionIndex(i => (i + 1) % completions.length);
      } else {
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

  return (
    <Box flexDirection="column" width="100%" minHeight={minH} justifyContent="flex-end">
      {showCompletions && (
        <Box
          flexDirection="column"
          marginBottom={0}
          paddingX={1}
        >
          {visibleCompletions.map((cmd, i) => {
            const selected = i === completionIndex;
            return (
              <Box key={cmd.name} flexDirection="row" gap={1}>
                {selected ? <Text bold color="cyan">{'>'}</Text> : <Text> </Text>}
                {selected ? (
                   <Text color="cyan" bold>{cmd.name.padEnd(14)}</Text>
                ) : (
                   <Text>{cmd.name.padEnd(14)}</Text>
                )}
                <Text dimColor={!selected}>{cmd.description}</Text>
                {cmd.shortcut && <Text dimColor color="gray"> ({cmd.shortcut})</Text>}
              </Box>
            );
          })}
          {completions.length > 8 && (
            <Text dimColor>  ... {completions.length - 8} more</Text>
          )}
        </Box>
      )}
      <Box flexDirection="row" alignItems="center">
        <Text bold color="cyan">opencern {'>'} </Text>
        {disabled ? (
          <Text dimColor italic>{placeholder || 'Processing...'}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder={placeholder || 'Ask anything or type / for commands...'}
          />
        )}
      </Box>
    </Box>
  );
}

export const Prompt = React.memo(PromptComponent);
export default Prompt;
