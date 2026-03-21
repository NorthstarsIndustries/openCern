import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
    models: { list: vi.fn() },
  })),
}));
vi.mock('../../src/utils/keystore.js', () => ({
  getKey: vi.fn(() => 'sk-ant-test-key'),
}));
vi.mock('../../src/utils/config.js', () => ({
  config: { get: vi.fn(() => 'claude-sonnet-4-6') },
}));
vi.mock('../../src/services/executor.js', () => ({
  execute: vi.fn(),
  estimateResources: vi.fn(() => ({ memoryMB: 128, cpuIntensive: false })),
}));
vi.mock('../../src/services/aiSystemPrompt.js', () => ({
  buildSystemPrompt: vi.fn(() => 'You are a CERN AI assistant'),
}));

import { anthropicService, executeToolCall } from '../../src/services/anthropic.js';
import { execute } from '../../src/services/executor.js';

beforeEach(() => {
  vi.clearAllMocks();
  anthropicService.clearHistory();
});

describe('AI tool loop integration', () => {
  it('should execute a Python tool call and return formatted result', async () => {
    vi.mocked(execute).mockResolvedValue({
      success: true,
      output: 'Mean pT: 45.2 GeV\nStd: 12.3 GeV',
      executionTime: 250,
    } as any);

    const result = await executeToolCall({
      id: 'tool-py-1',
      name: 'execute_python',
      input: { code: 'import numpy as np\nprint(f"Mean pT: {np.mean(pt_values):.1f} GeV")' },
    });

    expect(vi.mocked(execute)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'python' }),
    );
    expect(typeof result.output).toBe('string');
  });

  it('should execute a bash tool call safely', async () => {
    vi.mocked(execute).mockResolvedValue({
      success: true,
      output: 'data.root  events.json  processed/',
      executionTime: 50,
    } as any);

    const result = await executeToolCall({
      id: 'tool-bash-1',
      name: 'execute_bash',
      input: { command: 'ls ~/opencern-datasets/' },
    });

    expect(vi.mocked(execute)).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bash' }),
    );
    expect(typeof result.output).toBe('string');
  });

  it('should execute an opencern_cli tool call', async () => {
    vi.mocked(execute).mockResolvedValue({
      success: true,
      output: 'Found 5 local datasets',
      executionTime: 100,
    } as any);

    const result = await executeToolCall({
      id: 'tool-cli-1',
      name: 'opencern_cli',
      input: { args: '/datasets' },
    });

    expect(vi.mocked(execute)).toHaveBeenCalled();
    expect(typeof result.output).toBe('string');
  });

  it('should handle tool execution failure gracefully', async () => {
    vi.mocked(execute).mockResolvedValue({
      success: false,
      output: '',
      error: 'ModuleNotFoundError: No module named "scipy"',
      executionTime: 30,
    } as any);

    const result = await executeToolCall({
      id: 'tool-fail-1',
      name: 'execute_python',
      input: { code: 'from scipy.optimize import curve_fit' },
    });

    expect(result.success).toBe(false);
  });

  it('should maintain context across multiple interactions', () => {
    anthropicService.addContext({ experiment: 'CMS' });
    anthropicService.addContext({ downloadedDatasets: ['Run2016B'] });
    anthropicService.addContext({ processedFiles: ['events.json'] });

    const ctx = anthropicService.getContext();
    expect(ctx.experiment).toBe('CMS');
    expect(ctx.downloadedDatasets).toEqual(['Run2016B']);
    expect(ctx.processedFiles).toEqual(['events.json']);
  });

  it('should clear history between sessions', () => {
    anthropicService.addContext({ experiment: 'ATLAS' });
    anthropicService.clearHistory();

    const history = anthropicService.getHistory();
    expect(history).toEqual([]);
  });
});
