// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { join, extname, relative } from 'path';
import { homedir } from 'os';
import { config } from '../utils/config.js';

// ── Tree ─────────────────────────────────────────────────

export function renderTree(dir?: string): string[] {
  const targetDir = dir || config.get('dataDir');
  if (!existsSync(targetDir)) {
    return [`  [-] Directory not found: ${targetDir}`];
  }

  const lines: string[] = [
    '',
    `  ${targetDir}`,
    '  ────────────────────────────────────────',
  ];

  function walk(path: string, prefix: string, depth: number) {
    if (depth > 4) return;
    try {
      const entries = readdirSync(path, { withFileTypes: true })
        .filter(e => !e.name.startsWith('.'))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      entries.forEach((entry, i) => {
        const isLast = i === entries.length - 1;
        const connector = isLast ? '\\-- ' : '|-- ';
        const childPrefix = isLast ? '    ' : '|   ';
        const fullPath = join(path, entry.name);

        if (entry.isDirectory()) {
          lines.push(`  ${prefix}${connector}${entry.name}/`);
          walk(fullPath, prefix + childPrefix, depth + 1);
        } else {
          const stat = statSync(fullPath);
          const size = formatSize(stat.size);
          lines.push(`  ${prefix}${connector}${entry.name}  (${size})`);
        }
      });
    } catch { /* permission denied */ }
  }

  walk(targetDir, '', 0);
  lines.push('');
  return lines;
}

// ── Cat ──────────────────────────────────────────────────

export function catFile(filePath: string, maxLines = 50): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const fileLines = content.split('\n');
    const lines: string[] = [
      '',
      `  ${filePath.split('/').pop()} (${fileLines.length} lines)`,
      '  ────────────────────────────────────────',
    ];

    const displayed = fileLines.slice(0, maxLines);
    for (let i = 0; i < displayed.length; i++) {
      lines.push(`  ${String(i + 1).padStart(4)} | ${displayed[i]}`);
    }

    if (fileLines.length > maxLines) {
      lines.push(`  ... ${fileLines.length - maxLines} more lines (use /open for full view)`);
    }

    lines.push('');
    return lines;
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Grep ─────────────────────────────────────────────────

export function grepFile(pattern: string, filePath: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const fileLines = content.split('\n');
    const regex = new RegExp(pattern, 'gi');
    const matches: string[] = [];

    for (let i = 0; i < fileLines.length; i++) {
      if (regex.test(fileLines[i])) {
        matches.push(`  ${String(i + 1).padStart(4)} | ${fileLines[i]}`);
      }
    }

    if (matches.length === 0) return [`  No matches for "${pattern}" in ${filePath}`];

    return [
      '',
      `  ${matches.length} match(es) for "${pattern}" in ${filePath.split('/').pop()}`,
      '  ────────────────────────────────────────',
      ...matches.slice(0, 30),
      ...(matches.length > 30 ? [`  ... and ${matches.length - 30} more`] : []),
      '',
    ];
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Find ─────────────────────────────────────────────────

export function findFiles(pattern: string): string[] {
  const dataDir = config.get('dataDir');
  if (!existsSync(dataDir)) return [`  [-] Data directory not found: ${dataDir}`];

  const results: string[] = [];
  const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');

  function walk(dir: string) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          walk(fullPath);
        } else if (regex.test(entry.name)) {
          const stat = statSync(fullPath);
          results.push(`  ${relative(dataDir, fullPath).padEnd(40)} ${formatSize(stat.size)}`);
        }
      }
    } catch { /* skip */ }
  }

  walk(dataDir);

  if (results.length === 0) return [`  No files matching "${pattern}"`];

  return [
    '',
    `  ${results.length} file(s) matching "${pattern}"`,
    '  ────────────────────────────────────────',
    ...results.slice(0, 30),
    ...(results.length > 30 ? [`  ... and ${results.length - 30} more`] : []),
    '',
  ];
}

// ── Diff ─────────────────────────────────────────────────

export function diffFiles(file1: string, file2: string): string[] {
  if (!existsSync(file1)) return [`  [-] File not found: ${file1}`];
  if (!existsSync(file2)) return [`  [-] File not found: ${file2}`];

  const lines1 = readFileSync(file1, 'utf-8').split('\n');
  const lines2 = readFileSync(file2, 'utf-8').split('\n');

  const maxLines = Math.max(lines1.length, lines2.length);
  const diffs: string[] = [];
  let diffCount = 0;

  for (let i = 0; i < Math.min(maxLines, 100); i++) {
    const l1 = lines1[i] || '';
    const l2 = lines2[i] || '';
    if (l1 !== l2) {
      diffs.push(`  ${String(i + 1).padStart(4)} - ${l1.slice(0, 60)}`);
      diffs.push(`  ${String(i + 1).padStart(4)} + ${l2.slice(0, 60)}`);
      diffCount++;
    }
  }

  if (diffCount === 0) return ['  Files are identical'];

  return [
    '',
    `  Diff: ${file1.split('/').pop()} vs ${file2.split('/').pop()}`,
    '  ────────────────────────────────────────',
    `  ${diffCount} difference(s)`,
    '',
    ...diffs.slice(0, 50),
    ...(diffs.length > 50 ? ['  ... (truncated)'] : []),
    '',
  ];
}

// ── Clean ────────────────────────────────────────────────

export function cleanFiles(dryRun = true): string[] {
  const dataDir = config.get('dataDir');
  const cacheDir = join(homedir(), '.opencern', 'cache');
  const tmpPatterns = ['.tmp', '.partial', '.download'];
  const cleaned: { name: string; size: number }[] = [];

  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && tmpPatterns.some(p => entry.name.endsWith(p))) {
          const fullPath = join(dir, entry.name);
          const stat = statSync(fullPath);
          cleaned.push({ name: entry.name, size: stat.size });
          if (!dryRun) unlinkSync(fullPath);
        }
      }
    } catch { /* skip */ }
  }

  scanDir(dataDir);
  scanDir(cacheDir);

  if (cleaned.length === 0) {
    return ['  [+] No temporary files to clean'];
  }

  const totalSize = cleaned.reduce((s, f) => s + f.size, 0);
  const lines = [
    '',
    `  ${dryRun ? 'Would clean' : 'Cleaned'} ${cleaned.length} file(s)`,
    '  ────────────────────────────────────────',
    ...cleaned.map(f => `  ${f.name.padEnd(30)} ${formatSize(f.size)}`),
    '',
    `  Total: ${formatSize(totalSize)}`,
    ...(dryRun ? ['', '  Run /clean --confirm to delete'] : []),
    '',
  ];

  return lines;
}

// ── Disk ─────────────────────────────────────────────────

export function diskUsage(): string[] {
  const dataDir = config.get('dataDir');
  if (!existsSync(dataDir)) return [`  [-] Data directory not found: ${dataDir}`];

  const byType: Record<string, { count: number; size: number }> = {};
  let totalSize = 0;
  let totalFiles = 0;

  try {
    for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase() || '.other';
        const stat = statSync(join(dataDir, entry.name));
        if (!byType[ext]) byType[ext] = { count: 0, size: 0 };
        byType[ext].count++;
        byType[ext].size += stat.size;
        totalSize += stat.size;
        totalFiles++;
      }
    }
  } catch { /* skip */ }

  const lines: string[] = [
    '',
    '  Disk Usage',
    '  ────────────────────────────────────────',
    `  Directory: ${dataDir}`,
    '',
  ];

  const sorted = Object.entries(byType).sort((a, b) => b[1].size - a[1].size);
  for (const [ext, info] of sorted) {
    const pct = totalSize > 0 ? ((info.size / totalSize) * 100).toFixed(1) : '0.0';
    const barLen = totalSize > 0 ? Math.round((info.size / totalSize) * 30) : 0;
    const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(30 - barLen);
    lines.push(`  ${ext.padEnd(8)} ${bar} ${formatSize(info.size).padEnd(10)} ${info.count} file(s) (${pct}%)`);
  }

  lines.push('');
  lines.push(`  Total: ${formatSize(totalSize)} across ${totalFiles} file(s)`);
  lines.push('');
  return lines;
}

// ── Cache ────────────────────────────────────────────────

export function cacheInfo(clear = false): string[] {
  const cacheDir = join(homedir(), '.opencern', 'cache');
  if (!existsSync(cacheDir)) {
    return ['  [+] Cache is empty (directory does not exist)'];
  }

  let totalSize = 0;
  let fileCount = 0;

  try {
    for (const entry of readdirSync(cacheDir, { withFileTypes: true })) {
      if (entry.isFile()) {
        totalSize += statSync(join(cacheDir, entry.name)).size;
        fileCount++;
      }
    }
  } catch { /* skip */ }

  if (clear && fileCount > 0) {
    try {
      rmSync(cacheDir, { recursive: true, force: true });
      return [`  [+] Cache cleared: ${formatSize(totalSize)} freed`];
    } catch (err) {
      return [`  [-] Could not clear cache: ${(err as Error).message}`];
    }
  }

  return [
    '',
    '  Cache Info',
    '  ────────────────────────────────────────',
    `  Location:  ${cacheDir}`,
    `  Files:     ${fileCount}`,
    `  Size:      ${formatSize(totalSize)}`,
    '',
    '  Clear with: /cache clear',
    '',
  ];
}

function formatSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes > 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}
