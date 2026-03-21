import { describe, it, expect } from 'vitest';
import registry from '../registry.js';

describe('registry', () => {
  describe('getAll', () => {
    it('should return a non-empty array of commands', () => {
      const all = registry.getAll();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
    });

    it('should include core commands', () => {
      const all = registry.getAll();
      const names = all.map((c: any) => c.name);
      expect(names).toContain('/download');
      expect(names).toContain('/process');
      expect(names).toContain('/status');
      expect(names).toContain('/help');
    });
  });

  describe('find', () => {
    it('should find a command by name', () => {
      const cmd = registry.find('/download');
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe('/download');
    });

    it('should find a command by alias', () => {
      const all = registry.getAll();
      const withAlias = all.find((c: any) => c.aliases && c.aliases.length > 0);
      if (withAlias) {
        const found = registry.find(withAlias.aliases[0]);
        expect(found).toBeDefined();
        expect(found!.name).toBe(withAlias.name);
      }
    });

    it('should return undefined for unknown commands', () => {
      expect(registry.find('nonexistent-command')).toBeUndefined();
    });
  });

  describe('search', () => {
    it('should find commands matching a query', () => {
      const results = registry.search('download');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty for no matches', () => {
      const results = registry.search('zzz-no-match-zzz');
      expect(results).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('should return an array of category strings', () => {
      const cats = registry.getCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
    });
  });

  describe('getByCategory', () => {
    it('should return commands for a valid category', () => {
      const cats = registry.getCategories();
      const cmds = registry.getByCategory(cats[0]);
      expect(cmds.length).toBeGreaterThan(0);
      cmds.forEach((c: any) => expect(c.category).toBe(cats[0]));
    });
  });

  describe('getCategoryLabel', () => {
    it('should return a human-readable label', () => {
      const cats = registry.getCategories();
      const label = registry.getCategoryLabel(cats[0]);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  describe('getCompletions', () => {
    it('should return completions for partial input', () => {
      const completions = registry.getCompletions('/do');
      expect(completions.some((c: any) => c.name.startsWith('/do'))).toBe(true);
    });

    it('should return empty for no-match prefix', () => {
      const completions = registry.getCompletions('zzz');
      expect(completions).toEqual([]);
    });
  });

  describe('requiresApi', () => {
    it('should return boolean for known commands', () => {
      expect(typeof registry.requiresApi('/download')).toBe('boolean');
    });

    it('should return false for unknown commands', () => {
      expect(registry.requiresApi('/nonexistent')).toBe(false);
    });
  });

  describe('requiresDocker', () => {
    it('should return boolean for known commands', () => {
      expect(typeof registry.requiresDocker('/download')).toBe('boolean');
    });

    it('should return false for unknown commands', () => {
      expect(registry.requiresDocker('/nonexistent')).toBe(false);
    });
  });
});
