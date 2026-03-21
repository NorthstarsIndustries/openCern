import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));
vi.mock('../../services/cern-api.js', () => ({
  cernApi: {
    getRootMetadata: vi.fn(),
    listFiles: vi.fn(),
  },
}));

import { readFileSync, existsSync, statSync } from 'fs';
import { cernApi } from '../../services/cern-api.js';
import { openFile, listLocalFiles } from '../open.js';

const mockedReadFile = vi.mocked(readFileSync);
const mockedExists = vi.mocked(existsSync);
const mockedStat = vi.mocked(statSync);
const mockedApi = vi.mocked(cernApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openFile', () => {
  it('should open JSON files and return parsed content', async () => {
    const json = JSON.stringify({ events: [{ pt: 45 }] });
    mockedExists.mockReturnValue(true);
    mockedReadFile.mockReturnValue(json);
    mockedStat.mockReturnValue({ size: json.length } as any);

    const result = await openFile('/data/events.json');

    expect(result.fileType).toBe('json');
    expect(result.content).toContain('pt');
    expect(result.filename).toBe('events.json');
  });

  it('should open ROOT files via API metadata', async () => {
    mockedExists.mockReturnValue(true);
    mockedStat.mockReturnValue({ size: 50_000 } as any);
    mockedApi.getRootMetadata.mockResolvedValue({
      trees: ['Events'], branches: 100, entries: 5000,
    });

    const result = await openFile('/data/file.root');

    expect(result.fileType).toBe('root-meta');
    expect(result.content).toContain('Events');
  });

  it('should open plain text files', async () => {
    mockedExists.mockReturnValue(true);
    mockedReadFile.mockReturnValue('Hello world\nLine 2');
    mockedStat.mockReturnValue({ size: 20 } as any);

    const result = await openFile('/data/notes.txt');

    expect(result.fileType).toBe('text');
    expect(result.content).toContain('Hello world');
  });

  it('should throw for missing files', async () => {
    mockedExists.mockReturnValue(false);

    await expect(openFile('/nonexistent.json')).rejects.toThrow();
  });

  it('should handle malformed JSON gracefully', async () => {
    mockedExists.mockReturnValue(true);
    mockedReadFile.mockReturnValue('{broken json!!!');
    mockedStat.mockReturnValue({ size: 15 } as any);

    const result = await openFile('/data/bad.json');

    expect(result.fileType).toBe('text');
  });
});

describe('listLocalFiles', () => {
  it('should delegate to cernApi.listFiles', async () => {
    const files = [{ name: 'a.root', path: '/d/a.root', size: 100 }];
    mockedApi.listFiles.mockResolvedValue(files as any);

    const result = await listLocalFiles();

    expect(result).toEqual(files);
    expect(mockedApi.listFiles).toHaveBeenCalled();
  });
});
