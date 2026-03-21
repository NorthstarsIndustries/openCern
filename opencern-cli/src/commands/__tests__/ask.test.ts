import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

vi.mock('../../services/anthropic.js', () => ({
  anthropicService: {
    streamMessage: vi.fn(),
    clearHistory: vi.fn(),
    addContext: vi.fn(),
  },
}));

import { readFileSync, existsSync } from 'fs';
import { askQuestion, clearConversation } from '../ask.js';
import { anthropicService } from '../../services/anthropic.js';

const mockedStream = vi.mocked(anthropicService.streamMessage);
const mockedClear = vi.mocked(anthropicService.clearHistory);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('askQuestion', () => {
  it('should stream a basic question to anthropic', async () => {
    mockedStream.mockResolvedValueOnce({ totalTokens: 42 });
    const onToken = vi.fn();

    const result = await askQuestion('What is the Higgs boson?', {}, {} as any, onToken);

    expect(mockedStream).toHaveBeenCalledWith(
      expect.stringContaining('What is the Higgs boson?'),
      onToken,
      undefined,
    );
    expect(result.totalTokens).toBe(42);
  });

  it('should prepend file content when file option is provided', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ events: [1, 2, 3] }));
    mockedStream.mockResolvedValueOnce({ totalTokens: 10 });
    const onToken = vi.fn();

    await askQuestion('Analyze this', { file: '/data/events.json' }, {} as any, onToken);

    const calledWith = mockedStream.mock.calls[0][0] as string;
    expect(calledWith).toContain('events');
    expect(calledWith).toContain('Analyze this');
  });

  it('should truncate file content at 50k characters', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const largeContent = 'x'.repeat(60_000);
    vi.mocked(readFileSync).mockReturnValue(largeContent);
    mockedStream.mockResolvedValueOnce({ totalTokens: 5 });

    await askQuestion('Summarize', { file: '/data/big.txt' }, {} as any, vi.fn());

    const calledWith = mockedStream.mock.calls[0][0] as string;
    expect(calledWith).toContain('[truncated]');
  });

  it('should throw for missing file when file option is given', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(
      askQuestion('Tell me about this', { file: '/nonexistent.txt' }, {} as any, vi.fn()),
    ).rejects.toThrow('File not found');
  });

  it('should pass abort signal through', async () => {
    const controller = new AbortController();
    mockedStream.mockResolvedValueOnce({ totalTokens: 0 });

    await askQuestion('test', {}, {} as any, vi.fn(), controller.signal);

    expect(mockedStream).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      controller.signal,
    );
  });

  it('should add explain prefix when explain option is set', async () => {
    mockedStream.mockResolvedValueOnce({ totalTokens: 5 });

    await askQuestion('results', { explain: true }, {} as any, vi.fn());

    const calledWith = mockedStream.mock.calls[0][0] as string;
    expect(calledWith).toContain('explain');
  });
});

describe('clearConversation', () => {
  it('should delegate to anthropicService.clearHistory', () => {
    clearConversation();
    expect(mockedClear).toHaveBeenCalled();
  });
});
