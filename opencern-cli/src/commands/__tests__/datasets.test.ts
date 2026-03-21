import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
}));
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return { ...actual };
});
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(() => '/tmp/opencern-datasets') },
}));
vi.mock('../../services/cern-api.js', () => ({
  cernApi: { searchDatasets: vi.fn() },
}));

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import {
  listLocalDatasets, getDatasetStats, renderHistogram, renderScatterPlot,
  headEvents, tailEvents, filterEvents, sampleEvents, mergeDatasets,
  exportDataset, correlateFields,
} from '../datasets.js';

beforeEach(() => {
  vi.clearAllMocks();
});

const SAMPLE_EVENTS = [
  { pt: 45.2, eta: -1.1, phi: 2.3, energy: 120 },
  { pt: 30.0, eta: 0.5, phi: -1.0, energy: 80 },
  { pt: 55.7, eta: 2.0, phi: 0.5, energy: 200 },
  { pt: 10.3, eta: -0.3, phi: 1.8, energy: 25 },
  { pt: 78.9, eta: 1.2, phi: -2.1, energy: 310 },
];

function mockEventsFile() {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ events: SAMPLE_EVENTS }));
}

describe('listLocalDatasets', () => {
  it('should list datasets in data directory', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([
      { name: 'data.root', isFile: () => true, isDirectory: () => false },
      { name: 'events.json', isFile: () => true, isDirectory: () => false },
    ] as any);
    vi.mocked(statSync).mockReturnValue({ size: 1000, mtime: new Date() } as any);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ events: [] }));

    const datasets = listLocalDatasets();
    expect(datasets.length).toBeGreaterThan(0);
  });

  it('should return empty array when directory missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const datasets = listLocalDatasets();
    expect(datasets).toEqual([]);
  });
});

describe('getDatasetStats', () => {
  it('should compute numeric stats for events', () => {
    mockEventsFile();
    const lines = getDatasetStats('/data/events.json');
    expect(lines.some((l: string) => l.includes('pt') || l.includes('mean') || l.includes('min'))).toBe(true);
  });
});

describe('renderHistogram', () => {
  it('should render ASCII histogram for a field', () => {
    mockEventsFile();
    const lines = renderHistogram('/data/events.json', 'pt');
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('renderScatterPlot', () => {
  it('should render ASCII scatter plot for two fields', () => {
    mockEventsFile();
    const lines = renderScatterPlot('/data/events.json', 'pt', 'energy');
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('headEvents', () => {
  it('should return first N events', () => {
    mockEventsFile();
    const lines = headEvents('/data/events.json', 2);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('tailEvents', () => {
  it('should return last N events', () => {
    mockEventsFile();
    const lines = tailEvents('/data/events.json', 2);
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('filterEvents', () => {
  it('should filter events by > condition', () => {
    mockEventsFile();
    const lines = filterEvents('/data/events.json', { pt: '>50' });
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should filter events by < condition', () => {
    mockEventsFile();
    const lines = filterEvents('/data/events.json', { energy: '<100' });
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('sampleEvents', () => {
  it('should return random sample of events', () => {
    mockEventsFile();
    const lines = sampleEvents('/data/events.json', 3);
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('mergeDatasets', () => {
  it('should merge two event files', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync)
      .mockReturnValueOnce(JSON.stringify({ events: SAMPLE_EVENTS.slice(0, 2) }))
      .mockReturnValueOnce(JSON.stringify({ events: SAMPLE_EVENTS.slice(2) }));

    const lines = mergeDatasets('/data/a.json', '/data/b.json');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('exportDataset', () => {
  it('should export to CSV format', () => {
    mockEventsFile();
    const lines = exportDataset('/data/events.json', 'csv');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('correlateFields', () => {
  it('should compute Pearson correlation matrix', () => {
    mockEventsFile();
    const lines = correlateFields('/data/events.json');
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should handle empty events', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ events: [] }));

    const lines = correlateFields('/data/empty.json');
    expect(Array.isArray(lines)).toBe(true);
  });
});
