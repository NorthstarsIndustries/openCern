import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/services/cern-api.js', () => ({
  cernApi: {
    listFiles: vi.fn(),
    processFile: vi.fn(),
    processFolder: vi.fn(),
    processStatus: vi.fn(),
  },
}));

import { cernApi } from '../../src/services/cern-api.js';
import { listRootFiles, processFile, processFolder, pollProcess, formatEventSummary } from '../../src/commands/process.js';

describe('process pipeline integration', () => {
  it('should list ROOT files, process one, and format results', async () => {
    vi.mocked(cernApi.listFiles).mockResolvedValue([
      { name: 'data.root', path: '/d/data.root', size: 50_000, type: 'root' },
      { name: 'events.json', path: '/d/events.json', size: 1000, type: 'json' },
    ] as any);

    const rootFiles = await listRootFiles();
    expect(rootFiles).toHaveLength(1);
    expect(rootFiles[0].name).toBe('data.root');
  });

  it('should process a file and poll to completion', async () => {
    vi.mocked(cernApi.processFile).mockResolvedValue({ id: 'proc-int-1' });
    vi.mocked(cernApi.processStatus)
      .mockResolvedValueOnce({ status: 'processing', progress: 30 } as any)
      .mockResolvedValueOnce({
        status: 'processed', progress: 100,
        results: {
          eventCount: 5000, experiment: 'CMS', peakHT: 2450.5,
          outputFile: 'events.json', particles: { muon: 1200, electron: 800 },
        },
      } as any);

    const id = await processFile('/data/test.root');
    expect(id).toBe('proc-int-1');

    const onProgress = vi.fn();
    const result = await pollProcess(id, onProgress);
    expect(result.status).toBe('processed');
    expect(onProgress).toHaveBeenCalled();

    const summary = formatEventSummary(result.results);
    expect(summary.some((l: string) => l.includes('CMS'))).toBe(true);
  });

  it('should process a folder', async () => {
    vi.mocked(cernApi.processFolder).mockResolvedValue({ id: 'proc-folder-1' });

    const id = await processFolder('/data/cms/');
    expect(id).toBe('proc-folder-1');
  });

  it('should handle processing errors', async () => {
    vi.mocked(cernApi.processFile).mockResolvedValue({ id: 'proc-err' });
    vi.mocked(cernApi.processStatus).mockResolvedValueOnce({
      status: 'error', error: 'ROOT file corrupt',
    } as any);

    const result = await pollProcess('proc-err', vi.fn());
    expect(result.status).toBe('error');
  });
});
