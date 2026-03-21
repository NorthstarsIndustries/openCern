import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/cern-api.js', () => ({
  cernApi: {
    listFiles: vi.fn(),
    processFile: vi.fn(),
    processFolder: vi.fn(),
    processStatus: vi.fn(),
  },
}));

import { cernApi } from '../../services/cern-api.js';
import { listRootFiles, processFile, processFolder, pollProcess, formatEventSummary } from '../process.js';

const mockedApi = vi.mocked(cernApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listRootFiles', () => {
  it('should filter to only ROOT files', async () => {
    mockedApi.listFiles.mockResolvedValue([
      { name: 'data.root', path: '/d/data.root', size: 1000, type: 'root' },
      { name: 'events.json', path: '/d/events.json', size: 500, type: 'json' },
      { name: 'other.root', path: '/d/other.root', size: 2000, type: 'root' },
    ] as any);

    const files = await listRootFiles();

    expect(files).toHaveLength(2);
    expect(files.every((f: any) => f.name.endsWith('.root'))).toBe(true);
  });

  it('should return empty array when no ROOT files exist', async () => {
    mockedApi.listFiles.mockResolvedValue([
      { name: 'events.json', path: '/d/events.json', size: 500, type: 'json' },
    ] as any);

    const files = await listRootFiles();
    expect(files).toHaveLength(0);
  });
});

describe('processFile', () => {
  it('should return a process ID', async () => {
    mockedApi.processFile.mockResolvedValue({ id: 'proc-123' });

    const id = await processFile('/data/events.root');

    expect(id).toBe('proc-123');
    expect(mockedApi.processFile).toHaveBeenCalledWith('/data/events.root');
  });
});

describe('processFolder', () => {
  it('should return a process ID', async () => {
    mockedApi.processFolder.mockResolvedValue({ id: 'proc-folder-1' });

    const id = await processFolder('/data/cms/');

    expect(id).toBe('proc-folder-1');
  });
});

describe('pollProcess', () => {
  it('should poll until status is processed', async () => {
    const onProgress = vi.fn();

    mockedApi.processStatus
      .mockResolvedValueOnce({ status: 'processing', progress: 50 } as any)
      .mockResolvedValueOnce({ status: 'processed', progress: 100, results: { eventCount: 1000 } } as any);

    const result = await pollProcess('proc-123', onProgress);

    expect(result.status).toBe('processed');
    expect(onProgress).toHaveBeenCalled();
  });

  it('should stop polling on error status', async () => {
    mockedApi.processStatus.mockResolvedValueOnce({
      status: 'error', error: 'ROOT file corrupt',
    } as any);

    const result = await pollProcess('proc-err', vi.fn());

    expect(result.status).toBe('error');
  });
});

describe('formatEventSummary', () => {
  it('should format results with event count', () => {
    const results = {
      eventCount: 5000,
      experiment: 'CMS',
      peakHT: 2450.5,
      outputFile: 'events_processed.json',
      particles: { muon: 1200, electron: 800, photon: 3000 },
    };

    const lines = formatEventSummary(results as any);

    expect(lines.some((l: string) => l.includes('5,000') || l.includes('5000'))).toBe(true);
    expect(lines.some((l: string) => l.includes('CMS'))).toBe(true);
  });

  it('should handle undefined results', () => {
    const lines = formatEventSummary(undefined);
    expect(lines).toEqual([]);
  });
});
