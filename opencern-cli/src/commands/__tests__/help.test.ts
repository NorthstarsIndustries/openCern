import { describe, it, expect, vi } from 'vitest';

vi.mock('../registry.js', () => {
  const commands = [
    { name: '/download', description: 'Download datasets', category: 'data', aliases: ['dl'] },
    { name: '/process', description: 'Process ROOT files', category: 'data' },
    { name: '/ask', description: 'Ask AI a question', category: 'ai' },
    { name: '/status', description: 'System status', category: 'system' },
    { name: '/help', description: 'Show help', category: 'system' },
  ];
  const reg = {
    getAll: () => commands,
    getCategories: () => ['data', 'ai', 'system'],
    getByCategory: (cat: string) => commands.filter(c => c.category === cat),
    getCategoryLabel: (cat: string) => cat.charAt(0).toUpperCase() + cat.slice(1),
  };
  return { registry: reg, default: reg };
});

import { getHelpText, getBannerText } from '../help.js';

describe('getHelpText', () => {
  it('should return an array of help lines', () => {
    const lines = getHelpText();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should include command names', () => {
    const lines = getHelpText();
    const text = lines.join('\n');
    expect(text).toContain('/download');
    expect(text).toContain('/process');
    expect(text).toContain('/ask');
  });

  it('should group commands by category', () => {
    const lines = getHelpText();
    const text = lines.join('\n');
    expect(text).toContain('Data');
    expect(text).toContain('System');
  });
});

describe('getBannerText', () => {
  it('should return an array of banner lines', () => {
    const lines = getBannerText();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should contain ASCII art', () => {
    const lines = getBannerText();
    const text = lines.join('\n');
    expect(text.length).toBeGreaterThan(20);
  });
});
