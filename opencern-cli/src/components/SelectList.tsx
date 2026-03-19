// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SelectItem {
  label: string;
  value: string;
  description?: string;
}

interface SelectListProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
  onCancel?: () => void;
  title?: string;
  multiSelect?: boolean;
  maxVisible?: number;
  searchable?: boolean;
}

export function SelectList({
  items,
  onSelect,
  onCancel,
  title,
  multiSelect = false,
  maxVisible = 10,
  searchable = true,
}: SelectListProps): React.JSX.Element {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? items.filter(
        it =>
          it.label.toLowerCase().includes(filter.toLowerCase()) ||
          it.value.toLowerCase().includes(filter.toLowerCase()),
      )
    : items;

  const visible = filtered.slice(scrollOffset, scrollOffset + maxVisible);

  useInput((input, key) => {
    if (key.escape) {
      if (filter) {
        setFilter('');
        setCursor(0);
        setScrollOffset(0);
      } else {
        onCancel?.();
      }
      return;
    }

    if (key.upArrow) {
      if (cursor > 0) {
        setCursor(c => c - 1);
        if (cursor - 1 < scrollOffset) setScrollOffset(o => Math.max(0, o - 1));
      }
      return;
    }

    if (key.downArrow) {
      if (cursor < filtered.length - 1) {
        setCursor(c => c + 1);
        if (cursor + 1 >= scrollOffset + maxVisible) setScrollOffset(o => o + 1);
      }
      return;
    }

    if (key.return) {
      if (multiSelect && selected.size > 0) {
        // Return first selected item — caller can check the set
        const first = items.find(it => selected.has(it.value));
        if (first) onSelect(first);
      } else if (filtered[cursor]) {
        onSelect(filtered[cursor]);
      }
      return;
    }

    if (input === ' ' && multiSelect) {
      const item = filtered[cursor];
      if (item) {
        setSelected(prev => {
          const next = new Set(prev);
          if (next.has(item.value)) next.delete(item.value);
          else next.add(item.value);
          return next;
        });
      }
      return;
    }

    if (searchable && input && !key.ctrl && !key.meta) {
      if (key.backspace || key.delete) {
        setFilter(f => f.slice(0, -1));
      } else {
        setFilter(f => f + input);
      }
      setCursor(0);
      setScrollOffset(0);
    }
  });

  return (
    <Box flexDirection="column">
      {title && <Text bold color="blue">{title}</Text>}
      {searchable && filter && (
        <Box>
          <Text color="yellow">filter: </Text>
          <Text>{filter}</Text>
        </Box>
      )}
      {visible.map((item, i) => {
        const absIdx = i + scrollOffset;
        const isCursor = absIdx === cursor;
        const isSelected = selected.has(item.value);
        const prefix = multiSelect
          ? (isSelected ? '[x]' : '[ ]')
          : (isCursor ? ' > ' : '   ');
        return (
          <Box key={item.value} flexDirection="row" gap={1}>
            <Text color={isCursor ? 'cyan' : 'white'} bold={isCursor}>
              {prefix} {item.label}
            </Text>
            {item.description && <Text dimColor>{item.description}</Text>}
          </Box>
        );
      })}
      {filtered.length > maxVisible && (
        <Text dimColor>
          {scrollOffset + 1}-{Math.min(scrollOffset + maxVisible, filtered.length)} of {filtered.length}
        </Text>
      )}
      <Text dimColor color="gray">
        {multiSelect ? 'Space toggle, Enter confirm, Esc cancel' : 'Enter select, Esc cancel'}
      </Text>
    </Box>
  );
}

export default SelectList;
