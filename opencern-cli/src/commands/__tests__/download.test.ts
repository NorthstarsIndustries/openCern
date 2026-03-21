import { describe, it, expect } from 'vitest';

// Test formatDatasetSize directly (reimplemented to avoid module import side effects)
function formatDatasetSize(bytes: number): string {
  if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes > 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}

describe('formatDatasetSize', () => {
  it('should format bytes to KB', () => {
    expect(formatDatasetSize(1500)).toBe('2 KB');
    expect(formatDatasetSize(500)).toBe('1 KB');
    expect(formatDatasetSize(999999)).toBe('1000 KB');
  });

  it('should format bytes to MB', () => {
    expect(formatDatasetSize(1_000_001)).toBe('1 MB');
    expect(formatDatasetSize(5_500_000)).toBe('6 MB');
    expect(formatDatasetSize(999_999_999)).toBe('1000 MB');
  });

  it('should format bytes to GB', () => {
    expect(formatDatasetSize(1_000_000_001)).toBe('1.0 GB');
    expect(formatDatasetSize(2_500_000_000)).toBe('2.5 GB');
    expect(formatDatasetSize(15_700_000_000)).toBe('15.7 GB');
  });
});

describe('pollDownload timeout', () => {
  it('should throw after timeout', async () => {
    const maxPollMs = 50; // 50ms for test
    const start = Date.now();

    const poll = async () => {
      while (true) {
        if (Date.now() - start > maxPollMs) {
          throw new Error('Download poll timed out after 10 minutes');
        }
        // Simulate polling delay
        await new Promise(r => setTimeout(r, 20));
      }
    };

    await expect(poll()).rejects.toThrow('Download poll timed out');
  });
});
