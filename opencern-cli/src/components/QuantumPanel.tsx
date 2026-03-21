// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { QuantumJob, QuantumResults } from '../services/quantum.js';

interface QuantumPanelProps {
  job?: QuantumJob;
  isRunning?: boolean;
  backend?: string;
  circuitDiagram?: string;
}

function renderHistogram(histogram: Record<string, number>): React.ReactNode {
  const total = Object.values(histogram).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(histogram)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color="blue"> Measurement Histogram</Text>
      {sorted.map(([state, count]) => {
        const pct = (count / total) * 100;
        const barLen = Math.round(pct / 5);
        const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
        return (
          <Box key={state} flexDirection="row" gap={1}>
            <Text color="cyan">|{state.padEnd(6)}{'>'}</Text>
            <Text color="blue">{bar}</Text>
            <Text color="white">{pct.toFixed(1)}%</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function renderResults(results: QuantumResults): React.ReactNode {
  const sigPct = results.totalEvents > 0
    ? (results.signalCount / results.totalEvents * 100).toFixed(1)
    : '0.0';
  const bgPct = results.totalEvents > 0
    ? (results.backgroundCount / results.totalEvents * 100).toFixed(1)
    : '0.0';
  const sigBarLen = Math.round(results.signalProbability * 20);
  const bgBarLen = 20 - sigBarLen;

  return (
    <Box flexDirection="column" gap={0} marginTop={1}>
      <Text bold color="blue"> Classification Results</Text>
      <Box flexDirection="row" gap={1}>
        <Text color="green">Signal:    </Text>
        <Text>{results.signalCount}/{results.totalEvents} ({sigPct}%)</Text>
        <Text color="green">{'█'.repeat(sigBarLen)}</Text>
        <Text color="cyan">{(results.signalProbability * 100).toFixed(1)}% confidence</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Text color="red">Background:</Text>
        <Text>{results.backgroundCount}/{results.totalEvents} ({bgPct}%)</Text>
        <Text color="red">{'█'.repeat(bgBarLen)}</Text>
      </Box>
      <Box flexDirection="row" gap={2} marginTop={0}>
        <Text color="gray">Fidelity: <Text color="white">{results.fidelity.toFixed(3)}</Text></Text>
        <Text color="gray">Shots: <Text color="white">{results.shotsCompleted}</Text></Text>
      </Box>
      {results.histogram && Object.keys(results.histogram).length > 0 && renderHistogram(results.histogram)}
    </Box>
  );
}

export function QuantumPanel({ job, isRunning, backend, circuitDiagram }: QuantumPanelProps): React.JSX.Element {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={1} gap={0}>
      <Box flexDirection="row" gap={2}>
        <Text bold color="blue">[qc] Quantum Analysis</Text>
        <Text color="gray">Backend: </Text>
        <Text color="cyan">{backend || job?.backend || 'local'}</Text>
        {job?.queuePosition !== undefined && job.queuePosition > 0 && (
          <Text color="yellow"> Queue: #{job.queuePosition}</Text>
        )}
      </Box>

      {circuitDiagram && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="blue"> VQC Circuit</Text>
          {circuitDiagram.split('\n').map((line, i) => (
            <Text key={i} color="green">  {line}</Text>
          ))}
        </Box>
      )}

      {isRunning && !job?.results && (
        <Box marginTop={1}>
          <Text color="blue"><Spinner type="dots" /></Text>
          <Text color="gray">  Running quantum circuit...</Text>
          {job?.status && <Text color="gray" dimColor>  ({job.status})</Text>}
        </Box>
      )}

      {job?.error && (
        <Box marginTop={1}>
          <Text color="red">[-] Error: {job.error}</Text>
        </Box>
      )}

      {job?.results && renderResults(job.results)}
    </Box>
  );
}

export default QuantumPanel;
