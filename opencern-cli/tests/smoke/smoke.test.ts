import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/keystore.js', () => ({
  getKey: vi.fn(() => null),
  setKey: vi.fn(),
  hasKey: vi.fn(() => false),
  deleteKey: vi.fn(),
  maskKey: vi.fn((k: string) => k ? `${k.slice(0, 4)}...` : '****'),
  keystore: {
    getKey: vi.fn(() => null),
    setKey: vi.fn(),
    hasKey: vi.fn(() => false),
    deleteKey: vi.fn(),
    maskKey: vi.fn((k: string) => k ? `${k.slice(0, 4)}...` : '****'),
  },
  default: {
    getKey: vi.fn(() => null),
    setKey: vi.fn(),
    hasKey: vi.fn(() => false),
    deleteKey: vi.fn(),
    maskKey: vi.fn((k: string) => k ? `${k.slice(0, 4)}...` : '****'),
  },
}));

describe('Smoke Tests', () => {
  describe('CLI version', () => {
    it('package.json has a version string', async () => {
      const pkg = await import('../../package.json');
      expect(pkg.version).toBeDefined();
      expect(typeof pkg.version).toBe('string');
      expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('package name is @opencern/cli', async () => {
      const pkg = await import('../../package.json');
      expect(pkg.name).toBe('@opencern/cli');
    });
  });

  describe('help text', () => {
    it('getHelpText returns non-empty array', async () => {
      const { getHelpText } = await import('../../src/commands/help.js');
      const lines = getHelpText();
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(10);
    });

    it('help text contains CERN banner', async () => {
      const { getHelpText } = await import('../../src/commands/help.js');
      const text = getHelpText().join('\n');
      expect(text).toContain('CERN');
    });

    it('help text contains /help command', async () => {
      const { getHelpText } = await import('../../src/commands/help.js');
      const text = getHelpText().join('\n');
      expect(text).toContain('/help');
    });
  });

  describe('config loading', () => {
    it('config module can be imported', async () => {
      const configModule = await import('../../src/utils/config.js');
      expect(configModule).toBeDefined();
      expect(configModule.config).toBeDefined();
    });

    it('config has expected methods', async () => {
      const { config } = await import('../../src/utils/config.js');
      expect(typeof config.get).toBe('function');
      expect(typeof config.set).toBe('function');
    });

    it('config.get is a function', async () => {
      const { config } = await import('../../src/utils/config.js');
      expect(typeof config.get).toBe('function');
    });
  });

  describe('registry has commands', () => {
    it('registry exports getAll', async () => {
      const { registry } = await import('../../src/commands/registry.js');
      expect(typeof registry.getAll).toBe('function');
    });

    it('registry returns commands', async () => {
      const { registry } = await import('../../src/commands/registry.js');
      const cmds = registry.getAll();
      expect(cmds.length).toBeGreaterThan(10);
    });

    it('registry includes core commands', async () => {
      const { registry } = await import('../../src/commands/registry.js');
      expect(registry.find('/help')).toBeDefined();
      expect(registry.find('/status')).toBeDefined();
      expect(registry.find('/download')).toBeDefined();
      expect(registry.find('/process')).toBeDefined();
      expect(registry.find('/config')).toBeDefined();
    });

    it('registry has all expected categories', async () => {
      const { registry } = await import('../../src/commands/registry.js');
      const categories = registry.getCategories();
      expect(categories).toContain('data');
      expect(categories).toContain('analysis');
      expect(categories).toContain('ai');
      expect(categories).toContain('container');
      expect(categories).toContain('system');
    });

    it('registry.find returns undefined for unknown commands', async () => {
      const { registry } = await import('../../src/commands/registry.js');
      expect(registry.find('/nonexistent')).toBeUndefined();
    });
  });
});
