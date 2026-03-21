import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
      get: mockInstance.get,
      post: mockInstance.post,
      delete: mockInstance.delete,
      isAxiosError: vi.fn((e: any) => e?.isAxiosError === true),
    },
  };
});
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(() => 'http://localhost:8080') },
}));
vi.mock('../../utils/auth.js', () => ({
  getToken: vi.fn(() => 'test-token'),
}));

import axios from 'axios';
import { cernApi } from '../cern-api.js';

const mockAxios = vi.mocked(axios);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('cernApi.health', () => {
  it('should return health status', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.get).mockResolvedValue({
      data: { status: 'ok', version: '1.0.0' },
    });

    const result = await cernApi.health();
    expect(result).toHaveProperty('status');
  });
});

describe('cernApi.searchDatasets', () => {
  it('should search datasets with query parameters', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.get).mockResolvedValue({
      data: [{ id: 1, name: 'CMS Run2016', experiment: 'CMS' }],
    });

    const datasets = await cernApi.searchDatasets('CMS', 'all');
    expect(Array.isArray(datasets)).toBe(true);
  });
});

describe('cernApi.startDownload', () => {
  it('should start a download and return an ID', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.post).mockResolvedValue({
      data: { id: 'dl-123' },
    });

    const result = await cernApi.startDownload({ id: 1, name: 'test' } as any);
    expect(result).toHaveProperty('id');
  });
});

describe('cernApi.downloadStatus', () => {
  it('should return download progress', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.get).mockResolvedValue({
      data: { id: 'dl-123', status: 'downloading', progress: 50 },
    });

    const status = await cernApi.downloadStatus('dl-123');
    expect(status).toHaveProperty('status');
  });
});

describe('cernApi.cancelDownload', () => {
  it('should cancel a download', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.post).mockResolvedValue({ data: {} });

    await expect(cernApi.cancelDownload('dl-123')).resolves.toBeUndefined();
  });
});

describe('cernApi.listFiles', () => {
  it('should list files', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.get).mockResolvedValue({
      data: [{ name: 'test.root', size: 1000, type: 'root' }],
    });

    const files = await cernApi.listFiles();
    expect(Array.isArray(files)).toBe(true);
  });
});

describe('cernApi.processFile', () => {
  it('should start processing a file', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.post).mockResolvedValue({
      data: { id: 'proc-123' },
    });

    const result = await cernApi.processFile('/data/test.root');
    expect(result).toHaveProperty('id');
  });
});

describe('cernApi.processStatus', () => {
  it('should return processing status', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.get).mockResolvedValue({
      data: { status: 'processing', progress: 75 },
    });

    const status = await cernApi.processStatus('proc-123');
    expect(status).toHaveProperty('status');
  });
});

describe('cernApi.getRootMetadata', () => {
  it('should return ROOT file metadata', async () => {
    const mockInstance = mockAxios.create();
    vi.mocked(mockInstance.get).mockResolvedValue({
      data: { trees: ['Events'], branches: 50, entries: 10000 },
    });

    const meta = await cernApi.getRootMetadata('/data/test.root');
    expect(meta).toHaveProperty('trees');
  });
});

describe('error normalization', () => {
  it('should handle network errors gracefully', async () => {
    const mockInstance = mockAxios.create();
    const netError = new Error('ECONNREFUSED');
    (netError as any).isAxiosError = true;
    (netError as any).code = 'ECONNREFUSED';
    vi.mocked(mockInstance.get).mockRejectedValue(netError);

    await expect(cernApi.health()).rejects.toThrow();
  });

  it('should handle 401 errors', async () => {
    const mockInstance = mockAxios.create();
    const authError = new Error('Unauthorized');
    (authError as any).isAxiosError = true;
    (authError as any).response = { status: 401 };
    vi.mocked(mockInstance.get).mockRejectedValue(authError);

    await expect(cernApi.health()).rejects.toThrow();
  });
});
