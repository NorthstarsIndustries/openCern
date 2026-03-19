// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config } from '../utils/config.js';
import { getKey } from '../utils/keystore.js';
import { isAuthenticated } from '../utils/auth.js';

const SESSIONS_DIR = join(homedir(), '.opencern', 'sessions');
const ALIASES_FILE = join(homedir(), '.opencern', 'aliases.json');

function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

// ── Whoami ───────────────────────────────────────────────

export function whoami(): string[] {
  const username = getKey('opencern-username');
  const displayName = getKey('opencern-display-name');
  const email = getKey('opencern-email');
  const org = getKey('opencern-org');
  const authed = isAuthenticated();

  return [
    '',
    `  ${authed ? '[+]' : '[-]'} ${username || 'anonymous'}${displayName ? ` (${displayName})` : ''}`,
    ...(email ? [`  email: ${email}`] : []),
    ...(org ? [`  org:   ${org}`] : []),
    `  auth:  ${authed ? 'signed in' : 'not signed in'}`,
    `  model: ${config.get('defaultModel')}`,
    '',
  ];
}

// ── Sessions ─────────────────────────────────────────────

export interface SavedSession {
  name: string;
  timestamp: string;
  outputCount: number;
  model: string;
}

export function listSessions(): string[] {
  ensureSessionsDir();
  try {
    const files = readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return ['  No saved sessions. Use /save <name> to save.'];
    }

    const lines: string[] = [
      '',
      '  Saved Sessions',
      '  ────────────────────────────────────────',
    ];

    for (const file of files.slice(0, 20)) {
      try {
        const data = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8'));
        const name = file.replace('.json', '');
        lines.push(`  ${name.padEnd(20)} ${data.timestamp || 'unknown'}  ${data.outputCount || 0} lines`);
      } catch {
        lines.push(`  ${file.replace('.json', '').padEnd(20)} (corrupt)`);
      }
    }

    lines.push('');
    lines.push('  Load with: /load <name>');
    lines.push('');
    return lines;
  } catch {
    return ['  [-] Could not list sessions'];
  }
}

export function saveSession(name: string, output: { text: string }[]): string[] {
  ensureSessionsDir();
  const filePath = join(SESSIONS_DIR, `${name}.json`);
  const data = {
    name,
    timestamp: new Date().toISOString(),
    outputCount: output.length,
    model: config.get('defaultModel'),
    output: output.map(o => o.text),
  };

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    return [`  [+] Session saved: ${name} (${output.length} lines)`];
  } catch (err) {
    return [`  [-] Could not save session: ${(err as Error).message}`];
  }
}

export function loadSession(name: string): { lines: string[]; output: string[] } | null {
  const filePath = join(SESSIONS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return null;

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return {
      lines: [`  [+] Loaded session: ${name} (${data.outputCount} lines, ${data.timestamp})`],
      output: data.output || [],
    };
  } catch {
    return null;
  }
}

// ── Recall ───────────────────────────────────────────────

const RECALL_FILE = join(homedir(), '.opencern', 'recall.json');

export function saveRecall(label: string, data: unknown): void {
  let existing: Record<string, unknown>[] = [];
  try {
    if (existsSync(RECALL_FILE)) {
      existing = JSON.parse(readFileSync(RECALL_FILE, 'utf-8'));
    }
  } catch { /* reset */ }

  existing.push({ label, timestamp: new Date().toISOString(), data });
  if (existing.length > 50) existing = existing.slice(-50);

  try {
    const dir = join(homedir(), '.opencern');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(RECALL_FILE, JSON.stringify(existing, null, 2));
  } catch { /* ignore */ }
}

export function getRecall(): string[] {
  if (!existsSync(RECALL_FILE)) {
    return ['  No recent analysis results to recall.'];
  }

  try {
    const entries: { label: string; timestamp: string }[] = JSON.parse(readFileSync(RECALL_FILE, 'utf-8'));
    if (entries.length === 0) return ['  No recent analysis results.'];

    const lines: string[] = [
      '',
      '  Recent Analysis Results',
      '  ────────────────────────────────────────',
    ];

    for (const entry of entries.slice(-10).reverse()) {
      const ts = new Date(entry.timestamp).toLocaleString();
      lines.push(`  ${ts.padEnd(24)} ${entry.label}`);
    }

    lines.push('');
    return lines;
  } catch {
    return ['  [-] Could not read recall data'];
  }
}

// ── Aliases ──────────────────────────────────────────────

function loadAliases(): Record<string, string> {
  try {
    if (existsSync(ALIASES_FILE)) {
      return JSON.parse(readFileSync(ALIASES_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveAliases(aliases: Record<string, string>): void {
  const dir = join(homedir(), '.opencern');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2));
}

export function setAlias(name: string, command: string): string[] {
  const aliases = loadAliases();
  aliases[name] = command;
  saveAliases(aliases);
  return [`  [+] Alias set: ${name} -> ${command}`];
}

export function resolveAlias(input: string): string {
  const aliases = loadAliases();
  const parts = input.split(/\s+/);
  const cmd = parts[0];
  if (aliases[cmd]) {
    return aliases[cmd] + (parts.length > 1 ? ' ' + parts.slice(1).join(' ') : '');
  }
  return input;
}

export function listAliases(): string[] {
  const aliases = loadAliases();
  const keys = Object.keys(aliases);
  if (keys.length === 0) {
    return ['  No aliases configured. Use /alias <name> <command>'];
  }

  const lines: string[] = [
    '',
    '  Aliases',
    '  ────────────────────────────────────────',
  ];
  for (const [name, cmd] of Object.entries(aliases)) {
    lines.push(`  ${name.padEnd(16)} -> ${cmd}`);
  }
  lines.push('');
  return lines;
}

// ── Script ───────────────────────────────────────────────

export function loadScript(filePath: string): string[] | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
  } catch {
    return null;
  }
}

// ── Quick Config ─────────────────────────────────────────

export function quickGet(key: string): string[] {
  try {
    const val = config.get(key as never);
    return [`  ${key} = ${val}`];
  } catch {
    return [`  [-] Unknown config key: ${key}`];
  }
}

export function quickSet(key: string, value: string): string[] {
  try {
    if (key === 'defaultModel') {
      config.set('defaultModel', value);
    } else if (key === 'dataDir') {
      config.set('dataDir', value);
    } else if (key === 'apiBaseUrl') {
      config.set('apiBaseUrl', value);
    } else if (key === 'autoStartDocker') {
      config.set('autoStartDocker', value === 'true' || value === '1');
    } else {
      return [`  [-] Unknown key: ${key}. Try: defaultModel, dataDir, apiBaseUrl, autoStartDocker`];
    }
    return [`  [+] ${key} = ${value}`];
  } catch {
    return [`  [-] Could not set ${key}`];
  }
}
