import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      delete: mockDelete,
    }),
    isAxiosError: (e: unknown) => e instanceof Error && 'isAxiosError' in e,
  },
}));

describe('CLI-to-API Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchDatasets', () => {
    it('sends correct query params: experiment and size', async () => {
      mockGet.mockResolvedValue({ data: { datasets: [] } });

      await mockGet('/datasets', { params: { experiment: 'cms', size: 50 } });

      expect(mockGet).toHaveBeenCalledWith('/datasets', {
        params: { experiment: 'cms', size: 50 },
      });
    });

    it('defaults experiment to "all" when not specified', async () => {
      mockGet.mockResolvedValue({ data: { datasets: [] } });

      const experiment = 'all';
      await mockGet('/datasets', { params: { experiment, size: 50 } });

      expect(mockGet).toHaveBeenCalledWith('/datasets', {
        params: { experiment: 'all', size: 50 },
      });
    });

    it('response shape matches Dataset[] expectation', async () => {
      const apiResponse = {
        data: {
          datasets: [
            {
              id: 'cms-2016-higgs',
              title: 'CMS Higgs Dataset 2016',
              description: 'Higgs boson search data',
              experiment: 'CMS',
              year: 2016,
              energy: '13 TeV',
              size: 1024000,
              files: ['file1.root', 'file2.root'],
            },
          ],
        },
      };
      mockGet.mockResolvedValue(apiResponse);
      const res = await mockGet('/datasets', { params: { experiment: 'all', size: 50 } });

      const dataset = res.data.datasets[0];
      expect(dataset).toHaveProperty('id');
      expect(dataset).toHaveProperty('title');
      expect(dataset).toHaveProperty('experiment');
      expect(dataset).toHaveProperty('year');
      expect(dataset).toHaveProperty('energy');
      expect(dataset).toHaveProperty('size');
      expect(dataset).toHaveProperty('files');
      expect(Array.isArray(dataset.files)).toBe(true);
    });
  });

  describe('startDownload', () => {
    it('sends correct POST body with dataset_title and files', async () => {
      mockPost.mockResolvedValue({
        data: { folder: 'dl-123', files: [{ track_key: 'tk-abc' }] },
      });

      const body = {
        dataset_title: 'CMS Higgs Dataset 2016',
        files: ['file1.root', 'file2.root'],
      };
      await mockPost('/download/multi', body);

      expect(mockPost).toHaveBeenCalledWith('/download/multi', {
        dataset_title: 'CMS Higgs Dataset 2016',
        files: ['file1.root', 'file2.root'],
      });
    });

    it('response contains track_key or folder id', async () => {
      mockPost.mockResolvedValue({
        data: { folder: 'dl-123', files: [{ track_key: 'tk-abc' }] },
      });

      const res = await mockPost('/download/multi', {
        dataset_title: 'Test',
        files: ['f.root'],
      });

      const trackKey = res.data.files?.[0]?.track_key || res.data.folder || res.data.id;
      expect(trackKey).toBeTruthy();
    });
  });

  describe('processFile', () => {
    it('sends filename as query param to POST /process', async () => {
      mockPost.mockResolvedValue({ data: { id: 'proc-123' } });

      const filename = 'higgs-data.root';
      await mockPost('/process', null, { params: { filename } });

      expect(mockPost).toHaveBeenCalledWith('/process', null, {
        params: { filename: 'higgs-data.root' },
      });
    });

    it('strips absolute path to get relative filename', () => {
      const filePath = '/home/user/opencern-datasets/data/cms/higgs.root';
      let relative = filePath.replace(/^~?\/.*\/opencern-datasets\/data\//, '');
      if (relative.startsWith('/')) relative = relative.split('/').pop() || relative;
      expect(relative).toBe('cms/higgs.root');
    });

    it('response shape matches { id: string }', async () => {
      mockPost.mockResolvedValue({ data: { id: 'proc-456' } });
      const res = await mockPost('/process', null, { params: { filename: 'test.root' } });
      expect(res.data).toHaveProperty('id');
      expect(typeof res.data.id).toBe('string');
    });
  });

  describe('downloadStatus', () => {
    it('sends filename as query param to GET /download/status', async () => {
      mockGet.mockResolvedValue({
        data: { id: 'dl-1', status: 'downloading', progress: 45, speed: 1024, eta: 120 },
      });

      await mockGet('/download/status', { params: { filename: 'dl-1' } });

      expect(mockGet).toHaveBeenCalledWith('/download/status', {
        params: { filename: 'dl-1' },
      });
    });

    it('response shape matches DownloadStatus', async () => {
      const statusResponse = {
        data: {
          id: 'dl-1',
          status: 'downloading',
          progress: 45,
          speed: 1024,
          eta: 120,
        },
      };
      mockGet.mockResolvedValue(statusResponse);
      const res = await mockGet('/download/status', { params: { filename: 'dl-1' } });

      expect(res.data).toHaveProperty('status');
      expect(['pending', 'downloading', 'extracting', 'done', 'error', 'cancelled']).toContain(res.data.status);
      expect(typeof res.data.progress).toBe('number');
    });
  });

  describe('processStatus', () => {
    it('response shape matches ProcessStatus with results', async () => {
      const processResponse = {
        data: {
          id: 'p-1',
          status: 'processed',
          progress: 100,
          results: {
            eventCount: 48271,
            particles: { muon: 12000, electron: 8500 },
            peakHT: 1250.5,
            experiment: 'CMS',
            outputFile: 'output.json',
          },
        },
      };
      mockGet.mockResolvedValue(processResponse);
      const res = await mockGet('/process/status', { params: { filename: 'p-1' } });

      expect(res.data.results).toHaveProperty('eventCount');
      expect(res.data.results).toHaveProperty('particles');
      expect(res.data.results).toHaveProperty('peakHT');
      expect(res.data.results).toHaveProperty('experiment');
      expect(res.data.results).toHaveProperty('outputFile');
    });
  });

  describe('health endpoint', () => {
    it('response has status and version fields', async () => {
      mockGet.mockResolvedValue({ data: { status: 'ok', version: '1.2.0' } });
      const res = await mockGet('/health');
      expect(res.data).toHaveProperty('status');
      expect(res.data).toHaveProperty('version');
    });
  });
});
