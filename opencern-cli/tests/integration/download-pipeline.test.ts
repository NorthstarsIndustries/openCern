import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/services/cern-api.js', () => ({
  cernApi: {
    searchDatasets: vi.fn(),
    startDownload: vi.fn(),
    downloadStatus: vi.fn(),
    cancelDownload: vi.fn(),
  },
}));

import { cernApi } from '../../src/services/cern-api.js';
import { searchDatasets, startDownload, pollDownload, cancelDownload } from '../../src/commands/download.js';

describe('download pipeline integration', () => {
  it('should search for datasets and return results', async () => {
    vi.mocked(cernApi.searchDatasets).mockResolvedValue([
      { id: 1, name: 'CMS Run2016B', experiment: 'CMS', files: 5, size: 1_000_000 },
    ] as any);

    const results = await searchDatasets('CMS 2016');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should start a download and get an ID', async () => {
    vi.mocked(cernApi.startDownload).mockResolvedValue({ id: 'dl-integration-1' });

    const id = await startDownload({ id: 1, name: 'test' } as any);
    expect(id).toBe('dl-integration-1');
  });

  it('should poll download until completion', async () => {
    vi.mocked(cernApi.downloadStatus)
      .mockResolvedValueOnce({ id: 'dl-1', status: 'downloading', progress: 50 } as any)
      .mockResolvedValueOnce({ id: 'dl-1', status: 'downloading', progress: 80 } as any)
      .mockResolvedValueOnce({ id: 'dl-1', status: 'done', progress: 100 } as any);

    const onProgress = vi.fn();
    const result = await pollDownload('dl-1', onProgress);

    expect(result.status).toBe('done');
    expect(onProgress).toHaveBeenCalled();
  });

  it('should cancel a download', async () => {
    vi.mocked(cernApi.cancelDownload).mockResolvedValue(undefined);

    await expect(cancelDownload('dl-1')).resolves.toBeUndefined();
  });

  it('should handle download errors during polling', async () => {
    vi.mocked(cernApi.downloadStatus).mockResolvedValueOnce({
      id: 'dl-err', status: 'error', error: 'Network timeout',
    } as any);

    const result = await pollDownload('dl-err', vi.fn());
    expect(result.status).toBe('error');
  });
});
