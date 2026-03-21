import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../open.js', () => ({
  openFile: vi.fn(),
}));
vi.mock('../ask.js', () => ({
  askQuestion: vi.fn(),
}));
vi.mock('../../services/anthropic.js', () => ({
  anthropicService: {
    addContext: vi.fn(),
    getContext: vi.fn(() => ({})),
  },
}));

import { openFile } from '../open.js';
import { askQuestion } from '../ask.js';
import { anthropicService } from '../../services/anthropic.js';
import { openAndAsk } from '../opask.js';

const mockedOpenFile = vi.mocked(openFile);
const mockedAskQuestion = vi.mocked(askQuestion);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openAndAsk', () => {
  it('should open file and ask AI for analysis', async () => {
    mockedOpenFile.mockResolvedValue({
      content: '{"events":[{"pt":45}]}',
      filename: 'events.json',
      size: 100,
      fileType: 'json',
    });
    mockedAskQuestion.mockResolvedValue({ totalTokens: 150 });

    const onToken = vi.fn();
    const result = await openAndAsk('/data/events.json', onToken);

    expect(mockedOpenFile).toHaveBeenCalledWith('/data/events.json');
    expect(mockedAskQuestion).toHaveBeenCalledWith(
      expect.stringContaining('analyze'),
      expect.any(Object),
      expect.any(Object),
      onToken,
      undefined,
    );
    expect(result.file.filename).toBe('events.json');
    expect(result.totalTokens).toBe(150);
  });

  it('should pass abort signal through', async () => {
    mockedOpenFile.mockResolvedValue({
      content: 'test', filename: 'test.txt', size: 4, fileType: 'text',
    });
    mockedAskQuestion.mockResolvedValue({ totalTokens: 10 });
    const controller = new AbortController();

    await openAndAsk('/data/test.txt', vi.fn(), controller.signal);

    expect(mockedAskQuestion).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.any(Object),
      expect.any(Function),
      controller.signal,
    );
  });

  it('should add context to anthropic service', async () => {
    mockedOpenFile.mockResolvedValue({
      content: 'content', filename: 'data.json', size: 7, fileType: 'json',
    });
    mockedAskQuestion.mockResolvedValue({ totalTokens: 5 });

    await openAndAsk('/data/data.json', vi.fn());

    expect(anthropicService.addContext).toHaveBeenCalled();
  });
});
