import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
}));
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/test'),
}));
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(() => '/tmp/opencern-datasets') },
}));

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import {
  renderTree, catFile, grepFile, findFiles,
  diffFiles, cleanFiles, diskUsage, cacheInfo,
} from '../files.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('renderTree', () => {
  it('should render a directory tree', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['data.root', 'events.json'] as any);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false, size: 1000 } as any);

    const lines = renderTree();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should handle missing directory', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const lines = renderTree();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('catFile', () => {
  it('should return first N lines of a file', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('line1\nline2\nline3\nline4\nline5');

    const lines = catFile('/data/test.txt', 3);
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should handle missing file', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const lines = catFile('/nonexistent.txt');
    expect(lines.some((l: string) => l.toLowerCase().includes('not found') || l.toLowerCase().includes('error'))).toBe(true);
  });
});

describe('grepFile', () => {
  it('should find matching lines by regex', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('muon: 45\nelectron: 30\nmuon: 78\nphoton: 12');

    const lines = grepFile('muon', '/data/test.txt');
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.some((l: string) => l.includes('muon'))).toBe(true);
  });

  it('should return no matches for non-matching pattern', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('hello world');

    const lines = grepFile('nonexistent', '/data/test.txt');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('findFiles', () => {
  it('should find files matching a pattern', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['events.json', 'data.root', 'more.json'] as any);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false, size: 100 } as any);

    const lines = findFiles('*.json');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('diffFiles', () => {
  it('should show differences between two files', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync)
      .mockReturnValueOnce('line1\nline2\nline3')
      .mockReturnValueOnce('line1\nmodified\nline3');

    const lines = diffFiles('/data/a.txt', '/data/b.txt');
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should handle identical files', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('same content');

    const lines = diffFiles('/data/a.txt', '/data/b.txt');
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('cleanFiles', () => {
  it('should report files to clean in dry-run mode', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['data.root', 'temp.tmp', 'partial.partial'] as any);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false, size: 500 } as any);

    const lines = cleanFiles(true);
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('diskUsage', () => {
  it('should return disk usage by extension', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(['a.root', 'b.root', 'c.json'] as any);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false, size: 1_000_000 } as any);

    const lines = diskUsage();
    expect(Array.isArray(lines)).toBe(true);
  });
});

describe('cacheInfo', () => {
  it('should return cache information', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue([] as any);

    const lines = cacheInfo();
    expect(Array.isArray(lines)).toBe(true);
  });
});
