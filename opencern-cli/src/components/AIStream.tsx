// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ToolCall, ToolResult } from '../services/anthropic.js';

interface AIStreamProps {
  tokens: string;
  isStreaming: boolean;
  onCancel?: () => void;
  model?: string;
  tokenCount?: number;
  latency?: number;
  pendingTool?: ToolCall | null;
  toolResults?: ToolResult[];
  onApprove?: () => void;
  onDeny?: () => void;
  thinkingText?: string;
}

// ── Inline Formatting ────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|__[^_]+__|~~[^~]+~~)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} bold>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <Text key={i} bold>{part.slice(2, -2)}</Text>;
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <Text key={i} italic>{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <Text key={i} color="cyan">{part.slice(1, -1)}</Text>;
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <Text key={i} strikethrough>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}

// ── Markdown Renderer ────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let orderedListCounter = 0;

  lines.forEach((line, i) => {
    // Code block boundaries
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        nodes.push(
          <Box key={`code-${i}`} flexDirection="column" marginY={0} paddingX={1} borderStyle="round" borderColor="gray">
            {codeLang && (
              <Text dimColor color="gray">{codeLang}</Text>
            )}
            {codeLines.map((l, j) => (
              <Text key={j}>{l}</Text>
            ))}
          </Box>
        );
        codeLines = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        codeLang = line.slice(3).trim();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      nodes.push(<Text key={i} dimColor>{'─'.repeat(40)}</Text>);
      return;
    }

    // Headers
    if (line.startsWith('#### ')) {
      nodes.push(<Text key={i} bold>{line.slice(5)}</Text>);
      return;
    }
    if (line.startsWith('### ')) {
      nodes.push(<Text key={i} bold>{line.slice(4)}</Text>);
      return;
    }
    if (line.startsWith('## ')) {
      nodes.push(<Text key={i} bold color="blue">{line.slice(3)}</Text>);
      return;
    }
    if (line.startsWith('# ')) {
      nodes.push(<Text key={i} bold color="blue">{line.slice(2)}</Text>);
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <Box key={i} flexDirection="row">
          <Text color="gray">{'\u2502'} </Text>
          <Text italic>{renderInline(line.slice(2))}</Text>
        </Box>
      );
      return;
    }

    // Ordered list
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const indent = orderedMatch[1];
      const content = orderedMatch[3];
      orderedListCounter++;
      nodes.push(
        <Text key={i}>{indent}  {orderedListCounter}. {renderInline(content)}</Text>
      );
      return;
    } else {
      orderedListCounter = 0;
    }

    // Unordered list
    if (line.match(/^\s*[-*+]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1] || '';
      const content = line.replace(/^\s*[-*+]\s/, '');
      nodes.push(<Text key={i}>{indent}  - {renderInline(content)}</Text>);
      return;
    }

    // Table detection (simple pipe table)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      // Skip separator rows
      if (cells.every(c => /^[-:]+$/.test(c))) {
        nodes.push(<Text key={i} dimColor>{'─'.repeat(40)}</Text>);
        return;
      }
      nodes.push(
        <Box key={i} flexDirection="row" gap={2}>
          {cells.map((cell, ci) => (
            <Text key={ci}>{renderInline(cell)}</Text>
          ))}
        </Box>
      );
      return;
    }

    // Regular paragraph
    nodes.push(<Text key={i}>{renderInline(line)}</Text>);
  });

  // Unclosed code block
  if (inCodeBlock && codeLines.length) {
    nodes.push(
      <Box key="code-end" flexDirection="column" marginY={0} paddingX={1} borderStyle="round" borderColor="gray">
        {codeLang && <Text dimColor color="gray">{codeLang}</Text>}
        {codeLines.map((l, j) => (
          <Text key={j}>{l}</Text>
        ))}
      </Box>
    );
  }

  return nodes;
}

// ── Spinner ──────────────────────────────────────────────

const SPINNER_FRAMES = ['\u2807', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

function StreamSpinner(): React.JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return <Text color="blue">{SPINNER_FRAMES[frame]}</Text>;
}

// ── Tool Approval Card ───────────────────────────────────

function ToolApprovalCard({ toolCall, onApprove, onDeny }: {
  toolCall: ToolCall;
  onApprove?: () => void;
  onDeny?: () => void;
}): React.JSX.Element {
  useInput((_input, key) => {
    if (key.return && onApprove) onApprove();
    if (key.escape && onDeny) onDeny();
  });

  const toolLabel = toolCall.name === 'execute_python' ? 'Python'
    : toolCall.name === 'execute_bash' ? 'Bash'
    : 'OpenCERN CLI';

  const codeLines = (toolCall.displayCode || '').split('\n');

  return (
    <Box flexDirection="column" marginY={1} paddingX={1} borderStyle="round" borderColor="yellow">
      <Box flexDirection="row" gap={2}>
        <Text bold color="yellow">[tool] {toolLabel}</Text>
        {toolCall.resourceWarning && (
          <Text dimColor color="yellow">[~] {toolCall.resourceWarning}</Text>
        )}
      </Box>
      <Box flexDirection="column" marginY={0} paddingLeft={1} borderStyle="round" borderColor="gray" marginTop={1} paddingX={1}>
        {codeLines.slice(0, 15).map((line, i) => (
          <Text key={i} dimColor>{line}</Text>
        ))}
        {codeLines.length > 15 && (
          <Text dimColor>... {codeLines.length - 15} more lines</Text>
        )}
      </Box>
      <Box gap={2} marginTop={1}>
        <Text dimColor>Press </Text>
        <Text bold color="green">Enter</Text>
        <Text dimColor> to run, </Text>
        <Text bold color="red">Esc</Text>
        <Text dimColor> to skip</Text>
      </Box>
    </Box>
  );
}

// ── Tool Result Card ─────────────────────────────────────

function ToolResultCard({ result }: { result: ToolResult }): React.JSX.Element {
  const statusIcon = result.success ? '[+]' : '[-]';
  const statusColor = result.success ? 'green' : 'red';
  const durationStr = result.duration ? ` ${result.duration}ms` : '';

  return (
    <Box flexDirection="column" marginY={0} paddingX={1}>
      <Box gap={1}>
        <Text color={statusColor} bold>{statusIcon}</Text>
        <Text dimColor>result{durationStr}</Text>
      </Box>
      {result.output && (
        <Box flexDirection="column" paddingLeft={2} marginY={0}>
          {result.output.split('\n').slice(0, 20).map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
          {result.output.split('\n').length > 20 && (
            <Text dimColor>... ({result.output.split('\n').length - 20} more lines)</Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ── Main Component ───────────────────────────────────────

export function AIStream({
  tokens,
  isStreaming,
  onCancel,
  model,
  tokenCount,
  latency,
  pendingTool,
  toolResults,
  onApprove,
  onDeny,
  thinkingText,
}: AIStreamProps): React.JSX.Element {
  useInput((_input, key) => {
    if (key.escape && isStreaming && onCancel) {
      onCancel();
    }
  });

  const renderedMarkdown = useMemo(() => renderMarkdown(tokens), [tokens]);

  const modelShort = model?.replace('claude-', '').replace(/-\d{8}$/, '') || '';
  const tokensPerSec = latency && tokenCount
    ? (tokenCount / (latency / 1000)).toFixed(0)
    : undefined;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Thinking / reasoning display */}
      {thinkingText && (
        <Box marginBottom={0} flexDirection="column">
          <Text dimColor>[thinking] {thinkingText}</Text>
        </Box>
      )}

      {/* Streaming indicator */}
      {isStreaming && !pendingTool && (
        <Box marginBottom={0} gap={1}>
          <StreamSpinner />
          <Text dimColor>generating...</Text>
        </Box>
      )}

      {/* Tool results history */}
      {toolResults?.map((result, i) => (
        <ToolResultCard key={i} result={result} />
      ))}

      {/* Main text content */}
      <Box flexDirection="column">
        {renderedMarkdown}
        {isStreaming && !pendingTool && <Text color="gray">_</Text>}
      </Box>

      {/* Tool approval card */}
      {pendingTool && (
        <ToolApprovalCard
          toolCall={pendingTool as ToolCall}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      )}

      {/* Footer stats */}
      {!isStreaming && tokens && (
        <Box marginTop={1} gap={2}>
          {model && <Text dimColor>{modelShort}</Text>}
          {tokenCount !== undefined && <Text dimColor>{tokenCount?.toLocaleString()} tokens</Text>}
          {latency !== undefined && <Text dimColor>{(latency ? latency / 1000 : 0).toFixed(1)}s</Text>}
          {tokensPerSec && <Text dimColor>{tokensPerSec} tok/s</Text>}
        </Box>
      )}
    </Box>
  );
}

export default React.memo(AIStream);
