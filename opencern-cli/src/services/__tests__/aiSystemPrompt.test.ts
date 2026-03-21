import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../aiSystemPrompt.js';

describe('buildSystemPrompt', () => {
  it('should return a non-empty prompt string', () => {
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should contain CERN-related content', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('CERN');
  });

  it('should contain physics terminology', () => {
    const prompt = buildSystemPrompt();
    const lower = prompt.toLowerCase();
    expect(lower).toContain('particle');
  });

  it('should inject experiment context when provided', () => {
    const prompt = buildSystemPrompt({ experiment: 'CMS' });
    expect(prompt).toContain('CMS');
  });

  it('should inject downloaded datasets context', () => {
    const prompt = buildSystemPrompt({
      downloadedDatasets: ['CMS_Run2016B', 'ATLAS_2018'],
    });
    expect(prompt).toContain('CMS_Run2016B');
    expect(prompt).toContain('ATLAS_2018');
  });

  it('should inject processed files context', () => {
    const prompt = buildSystemPrompt({
      processedFiles: ['events_processed.json'],
    });
    expect(prompt).toContain('events_processed.json');
  });

  it('should inject quantum results context', () => {
    const prompt = buildSystemPrompt({
      quantumResults: { signal: 0.85, background: 0.15 },
    });
    expect(prompt).toContain('0.85');
  });

  it('should inject multiple context fields together', () => {
    const prompt = buildSystemPrompt({
      experiment: 'ALICE',
      totalEvents: 50000,
      peakHT: 2450.5,
    });
    expect(prompt).toContain('ALICE');
    expect(prompt).toContain('50000');
    expect(prompt).toContain('2450.5');
  });

  it('should handle empty context gracefully', () => {
    const prompt = buildSystemPrompt({});
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });
});
