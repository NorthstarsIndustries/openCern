// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

interface FilePreviewProps {
  content: string;
  filename?: string;
  size?: number;
  fileType?: 'json' | 'text' | 'root-meta';
  onClose?: () => void;
  focused?: boolean;
  maxHeight?: number;
}

function renderRootMeta(content: string): React.ReactNode {
  try {
    const meta = JSON.parse(content);
    return (
      <Box flexDirection="column">
        <Text bold color="blue"> ROOT File Structure</Text>
        {Object.entries(meta).map(([key, val]) => (
          <Box key={key} flexDirection="column" marginLeft={2}>
            <Text color="cyan">TTree: {key}</Text>
            {Array.isArray(val) && val.map((b: unknown) => (
              <Text key={String(b)} color="gray">  \\-- {String(b)}</Text>
            ))}
          </Box>
        ))}
      </Box>
    );
  } catch {
    return <Text>{content}</Text>;
  }
}

function formatSize(bytes: number): string {
  if (bytes > 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes > 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes > 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

// Simple syntax coloring for different file types
function colorLine(line: string, fileType: string, searchTerm: string): React.ReactNode {
  if (searchTerm && line.toLowerCase().includes(searchTerm.toLowerCase())) {
    return <Text backgroundColor="yellow" color="black">{line}</Text>;
  }

  if (fileType === 'json') {
    const keyMatch = line.match(/^(\s*)"([^"]+)":/);
    if (keyMatch) {
      return (
        <Text>
          <Text color="gray">{line.slice(0, line.indexOf('"'))}</Text>
          <Text color="yellow">"{keyMatch[2]}"</Text>
          <Text color="white">{line.slice(line.indexOf(':'))}</Text>
        </Text>
      );
    }
    if (/:\s*-?\d+\.?\d*/.test(line)) return <Text color="magenta">{line}</Text>;
    if (/:\s*(true|false|null)/.test(line)) return <Text color="blue">{line}</Text>;
    if (line.includes(': "')) return <Text color="green">{line}</Text>;
  }

  // Python highlighting
  if (fileType === 'text') {
    if (/^\s*(def |class |import |from |if |else|elif |for |while |return |raise |try|except|with )/.test(line)) {
      return <Text color="blue">{line}</Text>;
    }
    if (/^\s*#/.test(line)) return <Text color="gray">{line}</Text>;
  }

  return <Text color="white">{line}</Text>;
}

export function FilePreview({
  content,
  filename,
  size,
  fileType = 'text',
  onClose,
  focused = true,
  maxHeight,
}: FilePreviewProps): React.JSX.Element {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const { stdout } = useStdout();

  // Dynamic visible lines based on terminal height
  const VISIBLE_LINES = maxHeight || Math.max(10, (stdout?.rows || 24) - 12);
  const lines = content.split('\n');
  const totalLines = lines.length;
  const maxOffset = Math.max(0, totalLines - VISIBLE_LINES);

  useInput((input, key) => {
    if (!focused) return;

    if (key.escape) {
      if (searching) { setSearching(false); setSearchTerm(''); return; }
      if (onClose) onClose();
      return;
    }

    // Vim-style scrolling
    if (input === 'j' && !searching) {
      setScrollOffset(o => Math.min(maxOffset, o + 1));
      return;
    }
    if (input === 'k' && !searching) {
      setScrollOffset(o => Math.max(0, o - 1));
      return;
    }
    if (input === 'g' && !searching) {
      setScrollOffset(0);
      return;
    }
    if (input === 'G' && !searching) {
      setScrollOffset(maxOffset);
      return;
    }

    if (key.upArrow) { setScrollOffset(o => Math.max(0, o - 1)); return; }
    if (key.downArrow) { setScrollOffset(o => Math.min(maxOffset, o + 1)); return; }

    // Page up/down
    if (key.pageUp || (key.ctrl && input === 'u')) {
      setScrollOffset(o => Math.max(0, o - VISIBLE_LINES));
      return;
    }
    if (key.pageDown || (key.ctrl && input === 'd')) {
      setScrollOffset(o => Math.min(maxOffset, o + VISIBLE_LINES));
      return;
    }

    // Ctrl+F to search
    if (input === '\x06') { setSearching(true); return; }

    if (searching) {
      if (key.backspace || key.delete) {
        setSearchTerm(t => t.slice(0, -1));
      } else if (key.return) {
        // Jump to next match
        if (searchTerm) {
          const lc = searchTerm.toLowerCase();
          for (let i = scrollOffset + 1; i < totalLines; i++) {
            if (lines[i].toLowerCase().includes(lc)) {
              setScrollOffset(Math.min(i, maxOffset));
              break;
            }
          }
        }
      } else if (input && !key.ctrl) {
        setSearchTerm(t => t + input);
      }
    }
  });

  if (fileType === 'root-meta') {
    return (
      <Box flexDirection="column">
        {renderRootMeta(content)}
        <Text dimColor> Esc to close</Text>
      </Box>
    );
  }

  const visibleLines = lines.slice(scrollOffset, scrollOffset + VISIBLE_LINES);
  const scrollPct = totalLines > VISIBLE_LINES
    ? Math.round((scrollOffset / maxOffset) * 100)
    : 100;

  return (
    <Box flexDirection="column">
      {/* Header */}
      {filename && (
        <Box paddingX={1} marginBottom={0} gap={2}>
          <Text color="cyan" bold>{filename}</Text>
          {size !== undefined && <Text dimColor>{formatSize(size)}</Text>}
          <Text dimColor>{totalLines} lines</Text>
          <Text dimColor>{scrollPct}%</Text>
        </Box>
      )}

      {/* Search bar */}
      {searching && (
        <Box marginBottom={0} paddingX={1}>
          <Text color="yellow">search: </Text>
          <Text>{searchTerm}</Text>
          <Text color="gray" dimColor>|</Text>
          <Text dimColor> (Enter next match, Esc cancel)</Text>
        </Box>
      )}

      {/* Content */}
      <Box flexDirection="column">
        {visibleLines.map((line, i) => {
          const lineNum = scrollOffset + i + 1;
          return (
            <Box key={i} flexDirection="row">
              <Text color="gray" dimColor>{String(lineNum).padStart(4)} {'\u2502'} </Text>
              {colorLine(line, fileType, searchTerm)}
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box flexDirection="row" gap={2} marginTop={0} paddingX={1}>
        <Text dimColor>
          {scrollOffset + 1}-{Math.min(scrollOffset + VISIBLE_LINES, totalLines)}/{totalLines}
        </Text>
        <Text dimColor>j/k scroll  Ctrl+F search  g/G top/bottom  Esc close</Text>
      </Box>
    </Box>
  );
}

export default FilePreview;
