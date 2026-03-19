// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { config } from '../utils/config.js';
import { cernApi } from '../services/cern-api.js';

export interface LocalDataset {
  name: string;
  path: string;
  size: number;
  type: string;
  modified: Date;
  eventCount?: number;
  experiment?: string;
}

export function listLocalDatasets(): LocalDataset[] {
  const dataDir = config.get('dataDir');
  if (!existsSync(dataDir)) return [];

  const datasets: LocalDataset[] = [];
  try {
    for (const item of readdirSync(dataDir, { withFileTypes: true })) {
      if (item.isFile()) {
        const fullPath = join(dataDir, item.name);
        const stat = statSync(fullPath);
        const ext = extname(item.name).toLowerCase();
        if (['.root', '.json', '.csv'].includes(ext)) {
          const ds: LocalDataset = {
            name: item.name,
            path: fullPath,
            size: stat.size,
            type: ext.slice(1),
            modified: stat.mtime,
          };
          if (ext === '.json') {
            try {
              const raw = JSON.parse(readFileSync(fullPath, 'utf-8'));
              const events = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
              ds.eventCount = Array.isArray(events) ? events.length : 0;
              ds.experiment = raw.experiment || raw.metadata?.experiment;
            } catch { /* not a dataset json */ }
          }
          datasets.push(ds);
        }
      }
    }
  } catch { /* dir not readable */ }

  return datasets.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

export function formatDatasetList(datasets: LocalDataset[]): string[] {
  if (datasets.length === 0) {
    return [
      '',
      '  No local datasets found.',
      `  Download some with /download or check your data directory:`,
      `  ${config.get('dataDir')}`,
      '',
    ];
  }

  const lines: string[] = [
    '',
    '  Local Datasets',
    '  ────────────────────────────────────────────────────────────',
  ];

  const header = `  ${'Name'.padEnd(30)} ${'Type'.padEnd(6)} ${'Size'.padEnd(10)} ${'Events'.padEnd(10)} Modified`;
  lines.push(header);
  lines.push('  ' + '─'.repeat(76));

  for (const ds of datasets) {
    const size = formatSize(ds.size);
    const events = ds.eventCount !== undefined ? ds.eventCount.toLocaleString() : '—';
    const modified = ds.modified.toLocaleDateString();
    lines.push(
      `  ${ds.name.padEnd(30)} ${ds.type.padEnd(6)} ${size.padEnd(10)} ${events.padEnd(10)} ${modified}`,
    );
  }

  lines.push('');
  lines.push(`  ${datasets.length} dataset(s) in ${config.get('dataDir')}`);
  lines.push('');
  return lines;
}

function formatSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes > 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ── Stats ────────────────────────────────────────────────

export function getDatasetStats(filePath: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
    if (!Array.isArray(events) || events.length === 0) {
      return ['  [-] No events found in file'];
    }

    const numericFields: Record<string, number[]> = {};
    const categoricalFields: Record<string, Record<string, number>> = {};

    for (const ev of events) {
      for (const [key, val] of Object.entries(ev)) {
        if (typeof val === 'number') {
          if (!numericFields[key]) numericFields[key] = [];
          numericFields[key].push(val);
        } else if (typeof val === 'string') {
          if (!categoricalFields[key]) categoricalFields[key] = {};
          categoricalFields[key][val] = (categoricalFields[key][val] || 0) + 1;
        }
      }
    }

    const lines: string[] = [
      '',
      `  Dataset Statistics: ${filePath.split('/').pop()}`,
      '  ────────────────────────────────────────',
      `  Events:  ${events.length.toLocaleString()}`,
      '',
    ];

    if (Object.keys(numericFields).length > 0) {
      lines.push('  Numeric Fields');
      lines.push(`  ${'Field'.padEnd(16)} ${'Min'.padEnd(12)} ${'Max'.padEnd(12)} ${'Mean'.padEnd(12)} Std`);
      lines.push('  ' + '─'.repeat(60));
      for (const [field, values] of Object.entries(numericFields)) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
        lines.push(
          `  ${field.padEnd(16)} ${min.toFixed(3).padEnd(12)} ${max.toFixed(3).padEnd(12)} ${mean.toFixed(3).padEnd(12)} ${std.toFixed(3)}`,
        );
      }
    }

    if (Object.keys(categoricalFields).length > 0) {
      lines.push('');
      lines.push('  Categorical Fields');
      for (const [field, counts] of Object.entries(categoricalFields)) {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        lines.push(`  ${field}:`);
        for (const [val, count] of sorted) {
          const pct = ((count / events.length) * 100).toFixed(1);
          lines.push(`    ${val.padEnd(16)} ${String(count).padEnd(8)} (${pct}%)`);
        }
      }
    }

    lines.push('');
    return lines;
  } catch (err) {
    return [`  [-] Could not parse: ${(err as Error).message}`];
  }
}

// ── Histogram ────────────────────────────────────────────

export function renderHistogram(filePath: string, field: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
    const values = events.map(e => Number(e[field])).filter(v => !isNaN(v));

    if (values.length === 0) return [`  [-] No numeric values for field "${field}"`];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = 20;
    const binWidth = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);

    for (const v of values) {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      counts[idx]++;
    }

    const maxCount = Math.max(...counts);
    const barScale = 40;

    const lines: string[] = [
      '',
      `  Histogram: ${field}`,
      '  ────────────────────────────────────────',
      `  ${values.length} values, range [${min.toFixed(2)}, ${max.toFixed(2)}]`,
      '',
    ];

    for (let i = 0; i < bins; i++) {
      const lo = (min + i * binWidth).toFixed(1);
      const barLen = Math.round((counts[i] / maxCount) * barScale);
      const bar = '\u2588'.repeat(barLen);
      lines.push(`  ${lo.padStart(8)} | ${bar} ${counts[i]}`);
    }

    lines.push('');
    return lines;
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Scatter Plot ─────────────────────────────────────────

export function renderScatterPlot(filePath: string, xField: string, yField: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);

    const points = events
      .map(e => ({ x: Number(e[xField]), y: Number(e[yField]) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y));

    if (points.length === 0) return [`  [-] No numeric values for fields "${xField}", "${yField}"`];

    const width = 60;
    const height = 20;
    const xMin = Math.min(...points.map(p => p.x));
    const xMax = Math.max(...points.map(p => p.x));
    const yMin = Math.min(...points.map(p => p.y));
    const yMax = Math.max(...points.map(p => p.y));

    const grid: string[][] = Array.from({ length: height }, () =>
      Array(width).fill(' '),
    );

    for (const p of points.slice(0, 500)) {
      const px = Math.min(Math.floor(((p.x - xMin) / (xMax - xMin || 1)) * (width - 1)), width - 1);
      const py = Math.min(Math.floor(((yMax - p.y) / (yMax - yMin || 1)) * (height - 1)), height - 1);
      grid[py][px] = '*';
    }

    const lines: string[] = [
      '',
      `  Scatter: ${xField} vs ${yField}`,
      '  ────────────────────────────────────────',
      `  ${points.length} points`,
      '',
    ];

    for (let row = 0; row < height; row++) {
      const yLabel = row === 0 ? yMax.toFixed(1) : row === height - 1 ? yMin.toFixed(1) : '';
      lines.push(`  ${yLabel.padStart(8)} |${grid[row].join('')}|`);
    }

    lines.push(`  ${' '.repeat(9)}+${'─'.repeat(width)}+`);
    lines.push(`  ${' '.repeat(9)}${xMin.toFixed(1).padEnd(width / 2)}${xMax.toFixed(1).padStart(width / 2)}`);
    lines.push(`  ${' '.repeat(30)}${xField}`);
    lines.push('');
    return lines;
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Head/Tail ────────────────────────────────────────────

export function headEvents(filePath: string, n = 10): string[] {
  return showEvents(filePath, 0, n, 'head');
}

export function tailEvents(filePath: string, n = 10): string[] {
  return showEvents(filePath, -n, n, 'tail');
}

function showEvents(filePath: string, offset: number, count: number, label: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);

    if (events.length === 0) return ['  [-] No events in file'];

    const slice = offset < 0 ? events.slice(offset) : events.slice(offset, offset + count);
    const startIdx = offset < 0 ? Math.max(0, events.length + offset) : offset;

    const lines: string[] = [
      '',
      `  ${label} ${count} of ${events.length} events:`,
      '  ────────────────────────────────────────',
    ];

    for (let i = 0; i < slice.length; i++) {
      const ev = slice[i];
      const idx = startIdx + i;
      const summary = Object.entries(ev)
        .slice(0, 6)
        .map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(2) : v}`)
        .join(', ');
      lines.push(`  [${idx}] ${summary}`);
    }

    lines.push('');
    return lines;
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Describe ─────────────────────────────────────────────

export function describeDataset(filePath: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  const stat = statSync(filePath);
  const lines = [
    '',
    `  Dataset: ${filePath.split('/').pop()}`,
    '  ────────────────────────────────────────',
    `  Path:      ${filePath}`,
    `  Size:      ${formatSize(stat.size)}`,
    `  Modified:  ${stat.mtime.toLocaleString()}`,
    `  Type:      ${extname(filePath).slice(1).toUpperCase()}`,
  ];

  if (filePath.endsWith('.json')) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      const events = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);
      lines.push(`  Events:    ${Array.isArray(events) ? events.length.toLocaleString() : 'N/A'}`);
      if (raw.experiment) lines.push(`  Experiment: ${raw.experiment}`);
      if (raw.metadata?.energy) lines.push(`  Energy:    ${raw.metadata.energy}`);
      if (raw.metadata?.year) lines.push(`  Year:      ${raw.metadata.year}`);

      if (Array.isArray(events) && events.length > 0) {
        const fields = Object.keys(events[0] as Record<string, unknown>);
        lines.push(`  Fields:    ${fields.join(', ')}`);
      }
    } catch { /* not parseable */ }
  }

  lines.push('');
  return lines;
}

// ── Filter ───────────────────────────────────────────────

export function filterEvents(filePath: string, filters: Record<string, string>): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);

    let filtered = events;
    for (const [key, condition] of Object.entries(filters)) {
      const gtMatch = condition.match(/^>(\d+\.?\d*)$/);
      const ltMatch = condition.match(/^<(\d+\.?\d*)$/);
      const eqMatch = condition.match(/^=(.+)$/);

      if (gtMatch) {
        const threshold = parseFloat(gtMatch[1]);
        filtered = filtered.filter(e => Number(e[key]) > threshold);
      } else if (ltMatch) {
        const threshold = parseFloat(ltMatch[1]);
        filtered = filtered.filter(e => Number(e[key]) < threshold);
      } else if (eqMatch) {
        filtered = filtered.filter(e => String(e[key]) === eqMatch[1]);
      }
    }

    return [
      '',
      `  Filtered: ${filtered.length} / ${events.length} events`,
      '  ────────────────────────────────────────',
      ...filtered.slice(0, 20).map((ev, i) => {
        const summary = Object.entries(ev)
          .slice(0, 6)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(2) : v}`)
          .join(', ');
        return `  [${i}] ${summary}`;
      }),
      ...(filtered.length > 20 ? [`  ... and ${filtered.length - 20} more`] : []),
      '',
    ];
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Sample ───────────────────────────────────────────────

export function sampleEvents(filePath: string, n = 1000): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);

    const shuffled = [...events].sort(() => Math.random() - 0.5).slice(0, n);

    return [
      '',
      `  Random sample: ${shuffled.length} of ${events.length} events`,
      '  ────────────────────────────────────────',
      ...shuffled.slice(0, 20).map((ev, i) => {
        const summary = Object.entries(ev)
          .slice(0, 6)
          .map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(2) : v}`)
          .join(', ');
        return `  [${i}] ${summary}`;
      }),
      ...(shuffled.length > 20 ? [`  (showing first 20 of ${shuffled.length} sampled)`] : []),
      '',
    ];
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Export ────────────────────────────────────────────────

export function exportDataset(filePath: string, format: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);

    if (format === 'csv' && events.length > 0) {
      const headers = Object.keys(events[0] as Record<string, unknown>);
      const lines: string[] = [headers.join(',')];
      for (const ev of events) {
        lines.push(headers.map(h => String(ev[h] ?? '')).join(','));
      }
      const outPath = filePath.replace(/\.json$/, '.csv');
      const { writeFileSync } = require('fs') as typeof import('fs');
      writeFileSync(outPath, lines.join('\n'));
      return [`  [+] Exported ${events.length} events to ${outPath}`];
    }

    return [`  [-] Unsupported format: ${format}. Available: csv`];
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Merge ────────────────────────────────────────────────

export function mergeDatasets(file1: string, file2: string): string[] {
  if (!existsSync(file1)) return [`  [-] File not found: ${file1}`];
  if (!existsSync(file2)) return [`  [-] File not found: ${file2}`];

  try {
    const raw1 = JSON.parse(readFileSync(file1, 'utf-8'));
    const raw2 = JSON.parse(readFileSync(file2, 'utf-8'));

    const events1 = raw1.events || raw1.particles || (Array.isArray(raw1) ? raw1 : []);
    const events2 = raw2.events || raw2.particles || (Array.isArray(raw2) ? raw2 : []);

    const merged = { ...raw1, events: [...events1, ...events2] };
    const outPath = file1.replace(/\.json$/, '_merged.json');

    const { writeFileSync } = require('fs') as typeof import('fs');
    writeFileSync(outPath, JSON.stringify(merged, null, 2));

    return [
      '',
      `  [+] Merged ${events1.length} + ${events2.length} = ${events1.length + events2.length} events`,
      `  Output: ${outPath}`,
      '',
    ];
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}

// ── Correlate ────────────────────────────────────────────

export function correlateFields(filePath: string): string[] {
  if (!existsSync(filePath)) return [`  [-] File not found: ${filePath}`];

  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const events: Record<string, unknown>[] = raw.events || raw.particles || (Array.isArray(raw) ? raw : []);

    const numFields: string[] = [];
    if (events.length > 0) {
      for (const [key, val] of Object.entries(events[0] as Record<string, unknown>)) {
        if (typeof val === 'number') numFields.push(key);
      }
    }

    if (numFields.length < 2) return ['  [-] Need at least 2 numeric fields for correlation'];

    const data: Record<string, number[]> = {};
    for (const f of numFields) {
      data[f] = events.map(e => Number(e[f]));
    }

    function pearson(a: number[], b: number[]): number {
      const n = a.length;
      const meanA = a.reduce((s, v) => s + v, 0) / n;
      const meanB = b.reduce((s, v) => s + v, 0) / n;
      let num = 0, denA = 0, denB = 0;
      for (let i = 0; i < n; i++) {
        const da = a[i] - meanA;
        const db = b[i] - meanB;
        num += da * db;
        denA += da * da;
        denB += db * db;
      }
      const den = Math.sqrt(denA * denB);
      return den === 0 ? 0 : num / den;
    }

    const lines: string[] = [
      '',
      '  Correlation Matrix',
      '  ────────────────────────────────────────',
    ];

    const header = '  ' + ' '.repeat(12) + numFields.map(f => f.padStart(8)).join(' ');
    lines.push(header);

    for (const f1 of numFields) {
      let row = `  ${f1.padEnd(12)}`;
      for (const f2 of numFields) {
        const r = pearson(data[f1], data[f2]);
        row += r.toFixed(3).padStart(8) + ' ';
      }
      lines.push(row);
    }

    lines.push('');
    return lines;
  } catch (err) {
    return [`  [-] Error: ${(err as Error).message}`];
  }
}
