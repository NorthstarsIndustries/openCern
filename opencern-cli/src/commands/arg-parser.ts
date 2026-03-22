// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

export interface ParsedCommand {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
}

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const tokens = tokenize(trimmed);

  const command = tokens[0]?.toLowerCase() ?? '';
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');
      if (eqIdx !== -1) {
        flags[token.slice(2, eqIdx)] = token.slice(eqIdx + 1);
      } else {
        // Check if next token is a value (not a flag)
        if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
          flags[token.slice(2)] = tokens[++i];
        } else {
          flags[token.slice(2)] = true;
        }
      }
    } else if (token.startsWith('-') && token.length === 2) {
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        flags[token.slice(1)] = tokens[++i];
      } else {
        flags[token.slice(1)] = true;
      }
    } else {
      args.push(token);
    }
  }

  return { command, args, flags };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

export function resolveFilePath(arg: string): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  if (arg.startsWith('~/')) {
    return arg.replace('~', homeDir);
  }
  if (arg.startsWith('/')) return arg;
  // Relative path — resolve from data dir
  return arg;
}
