// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

export interface Column {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'right';
  format?: (val: unknown) => string;
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, unknown>[];
  onSelect?: (row: Record<string, unknown>) => void;
  maxRows?: number;
  title?: string;
  focused?: boolean;
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

function formatValue(val: unknown): string {
  if (typeof val === 'number') {
    if (Math.abs(val) >= 1e9) return val.toExponential(2);
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + 'M';
    if (Math.abs(val) >= 1e3) return val.toLocaleString();
    if (Math.abs(val) < 0.01 && val !== 0) return val.toExponential(2);
    return val.toFixed(2);
  }
  if (val === null || val === undefined) return '--';
  return String(val);
}

export function DataTable({
  columns,
  rows,
  onSelect,
  maxRows = 20,
  title,
  focused = true,
}: DataTableProps): React.JSX.Element {
  const [selectedRow, setSelectedRow] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const { stdout } = useStdout();
  const termWidth = stdout?.columns || 80;

  // Dynamic column widths based on content
  const colWidths = useMemo(() => {
    return columns.map(col => {
      if (col.width) return col.width;
      const headerLen = col.label.length + 2;
      const maxContent = rows.slice(0, 50).reduce((max, row) => {
        const formatted = col.format ? col.format(row[col.key]) : formatValue(row[col.key]);
        return Math.max(max, formatted.length);
      }, 0);
      return Math.min(Math.max(headerLen, maxContent + 2, 6), 30);
    });
  }, [columns, rows]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortAsc ? va - vb : vb - va;
      }
      const sa = String(va ?? '');
      const sb = String(vb ?? '');
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [rows, sortCol, sortAsc]);

  const visible = sortedRows.slice(scrollOffset, scrollOffset + maxRows);

  useInput((input, key) => {
    if (!focused) return;
    if (key.upArrow) {
      if (selectedRow > 0) {
        setSelectedRow(i => i - 1);
        if (selectedRow - 1 < scrollOffset) setScrollOffset(o => Math.max(0, o - 1));
      }
      return;
    }
    if (key.downArrow) {
      if (selectedRow < sortedRows.length - 1) {
        setSelectedRow(i => i + 1);
        if (selectedRow + 1 >= scrollOffset + maxRows) setScrollOffset(o => o + 1);
      }
      return;
    }
    if (key.tab) {
      // Cycle sort column
      const currentIdx = sortCol ? columns.findIndex(c => c.key === sortCol) : -1;
      const nextIdx = (currentIdx + 1) % columns.length;
      if (columns[nextIdx].key === sortCol) {
        setSortAsc(a => !a);
      } else {
        setSortCol(columns[nextIdx].key);
        setSortAsc(true);
      }
      return;
    }
    if (key.return && onSelect) {
      onSelect(sortedRows[selectedRow]);
    }
  });

  function renderCell(col: Column, val: unknown, width: number): string {
    const formatted = col.format ? col.format(val) : formatValue(val);
    if (col.align === 'right') {
      return truncate(formatted, width).padStart(width);
    }
    return truncate(formatted, width).padEnd(width);
  }

  return (
    <Box flexDirection="column">
      {title && <Text bold color="blue"> {title}</Text>}
      {/* Header */}
      <Box flexDirection="row">
        <Text> </Text>
        {columns.map((col, i) => {
          const sortIndicator = sortCol === col.key ? (sortAsc ? ' ^' : ' v') : '';
          return (
            <Text key={col.key} bold color="blue">
              {' '}{truncate(col.label, colWidths[i]).padEnd(colWidths[i])}{sortIndicator}{' '}
            </Text>
          );
        })}
      </Box>
      {/* Separator */}
      <Box flexDirection="row">
        <Text color="gray"> {'─'.repeat(colWidths.reduce((s, w) => s + w + 2, 1))}</Text>
      </Box>
      {/* Rows */}
      {visible.map((row, rowIdx) => {
        const absIdx = rowIdx + scrollOffset;
        const isSelected = focused && absIdx === selectedRow;
        return (
          <Box key={rowIdx} flexDirection="row">
            <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>
              {isSelected ? '>' : ' '}
            </Text>
            {columns.map((col, i) => (
              <Text
                key={col.key}
                color={isSelected ? 'cyan' : rowIdx % 2 === 0 ? 'white' : 'gray'}
                bold={isSelected}
              >
                {' '}{renderCell(col, row[col.key], colWidths[i])}{' '}
              </Text>
            ))}
          </Box>
        );
      })}
      {/* Footer */}
      <Box flexDirection="row" gap={2} marginTop={0}>
        {sortedRows.length > maxRows && (
          <Text dimColor>
            {scrollOffset + 1}-{Math.min(scrollOffset + maxRows, sortedRows.length)} of {sortedRows.length}
          </Text>
        )}
        {focused && (
          <Text dimColor>up/down navigate  Tab sort  {onSelect ? 'Enter select' : ''}</Text>
        )}
      </Box>
    </Box>
  );
}

export default DataTable;
