// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';

interface ProgressBarProps {
  label: string;
  percent: number;
  speed?: number;
  eta?: number;
  mode?: 'download' | 'process' | 'quantum' | 'upload';
  indeterminate?: boolean;
  done?: boolean;
  error?: boolean;
  nested?: { label: string; percent: number }[];
}

const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec > 1_000_000) return `${(bytesPerSec / 1_000_000).toFixed(1)} MB/s`;
  if (bytesPerSec > 1_000) return `${(bytesPerSec / 1_000).toFixed(0)} KB/s`;
  return `${bytesPerSec} B/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function modeLabel(mode: ProgressBarProps['mode']): string {
  switch (mode) {
    case 'download': return 'dl';
    case 'upload': return 'up';
    case 'quantum': return 'qc';
    case 'process': return 'op';
    default: return '--';
  }
}

export function ProgressBar({
  label,
  percent,
  speed,
  eta,
  mode,
  indeterminate = false,
  done = false,
  error = false,
  nested,
}: ProgressBarProps): React.JSX.Element {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const { stdout } = useStdout();
  const termWidth = stdout?.columns || 80;

  useEffect(() => {
    if (done) return;
    const interval = setInterval(() => {
      setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [done]);

  // Dynamic bar width: fill available space
  const fixedWidth = 6 + label.length + 1 + 5 + 1 + (speed !== undefined ? 12 : 0) + (eta !== undefined ? 10 : 0);
  const barWidth = Math.max(10, Math.min(40, termWidth - fixedWidth - 10));
  const filled = Math.round((Math.min(percent, 100) / 100) * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const color = error ? 'red' : done ? 'green' : 'blue';
  const tag = modeLabel(mode);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" gap={1}>
        <Text color="gray">[{tag}]</Text>
        <Text color={done ? 'green' : error ? 'red' : 'white'}>{label}</Text>
        {indeterminate ? (
          <Text color={color}>{SPINNER_FRAMES[spinnerFrame]}</Text>
        ) : (
          <>
            <Text color={color}>[{bar}]</Text>
            <Text color={color}>{Math.round(percent)}%</Text>
          </>
        )}
        {speed !== undefined && <Text color="gray">{formatSpeed(speed)}</Text>}
        {eta !== undefined && eta > 0 && !done && (
          <Text color="gray">eta {formatEta(eta)}</Text>
        )}
      </Box>
      {nested && nested.map((n, i) => {
        const nFilled = Math.round((Math.min(n.percent, 100) / 100) * 15);
        const nBar = '\u2588'.repeat(nFilled) + '\u2591'.repeat(15 - nFilled);
        return (
          <Box key={i} flexDirection="row" gap={1} paddingLeft={2}>
            <Text dimColor>{n.label.padEnd(20)}</Text>
            <Text color={n.percent >= 100 ? 'green' : 'gray'}>[{nBar}] {Math.round(n.percent)}%</Text>
          </Box>
        );
      })}
    </Box>
  );
}

export default ProgressBar;
