import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
    models: { list: vi.fn() },
  })),
}));
vi.mock('../../utils/keystore.js', () => ({
  getKey: vi.fn(() => 'sk-ant-test-key'),
}));
vi.mock('../../utils/config.js', () => ({
  config: { get: vi.fn(() => 'claude-sonnet-4-6') },
}));
vi.mock('../executor.js', () => ({
  execute: vi.fn(),
  estimateResources: vi.fn(() => ({ memoryMB: 128, cpuIntensive: false })),
}));
vi.mock('../aiSystemPrompt.js', () => ({
  buildSystemPrompt: vi.fn(() => 'You are a CERN AI assistant'),
}));

import { anthropicService, executeToolCall } from '../anthropic.js';
import { execute } from '../executor.js';

beforeEach(() => {
  vi.clearAllMocks();
  anthropicService.clearHistory();
});

describe('executeToolCall', () => {
  it('should dispatch to executor and return result', async () => {
    vi.mocked(execute).mockResolvedValue({
      success: true,
      output: 'Hello from Python',
      executionTime: 100,
    } as any);

    const result = await executeToolCall({
      id: 'tool-1',
      name: 'execute_python',
      input: { code: 'print("hello")' },
    });

    expect(vi.mocked(execute)).toHaveBeenCalled();
    expect(typeof result.success).toBe('boolean');
  });

  it('should handle execution failure', async () => {
    vi.mocked(execute).mockResolvedValue({
      success: false,
      output: '',
      error: 'Command failed',
      executionTime: 10,
    } as any);

    const result = await executeToolCall({
      id: 'tool-3',
      name: 'execute_bash',
      input: { command: 'bad-cmd' },
    });

    expect(result.success).toBe(false);
  });
});

describe('anthropicService.addContext', () => {
  it('should add context and retrieve it', () => {
    anthropicService.addContext({ experiment: 'CMS' });

    const ctx = anthropicService.getContext();
    expect(ctx.experiment).toBe('CMS');
  });

  it('should merge context additively', () => {
    anthropicService.addContext({ experiment: 'CMS' });
    anthropicService.addContext({ downloadedDatasets: ['ds1'] });

    const ctx = anthropicService.getContext();
    expect(ctx.experiment).toBe('CMS');
    expect(ctx.downloadedDatasets).toEqual(['ds1']);
  });
});

describe('anthropicService.clearHistory', () => {
  it('should clear conversation history', () => {
    anthropicService.clearHistory();
    const history = anthropicService.getHistory();
    expect(history).toEqual([]);
  });
});

describe('anthropicService.getUsage', () => {
  it('should return usage stats object', () => {
    const usage = anthropicService.getUsage();
    expect(typeof usage).toBe('object');
    expect(usage).not.toBeNull();
  });
});

describe('anthropicService.getUsageFormatted', () => {
  it('should return formatted usage lines', () => {
    const lines = anthropicService.getUsageFormatted();
    expect(Array.isArray(lines)).toBe(true);
  });
});
