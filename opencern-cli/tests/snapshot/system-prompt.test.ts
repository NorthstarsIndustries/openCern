import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/services/aiSystemPrompt.js';

describe('AI System Prompt Snapshot', () => {
  it('base prompt matches snapshot', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatchSnapshot();
  });

  it('prompt with session context matches snapshot', () => {
    const context = {
      experiment: 'CMS',
      downloadedDatasets: ['cms-higgs-2016', 'atlas-diphoton-2015'],
      processedFiles: ['higgs.root'],
    };
    const prompt = buildSystemPrompt(context);
    expect(prompt).toMatchSnapshot();
  });

  it('contains CERN-AI identity', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('CERN-AI');
  });

  it('contains core principles', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('ACCURACY FIRST');
    expect(prompt).toContain('PROGRESSIVE DEPTH');
    expect(prompt).toContain('ACTIONABLE INSIGHTS');
  });

  it('contains session awareness principle', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('SESSION AWARENESS');
  });

  it('includes session context when provided', () => {
    const prompt = buildSystemPrompt({
      experiment: 'ATLAS',
      downloadedDatasets: ['atlas-zboson-2012'],
    });
    expect(prompt).toContain('ATLAS');
    expect(prompt).toContain('atlas-zboson-2012');
  });

  it('prompt length is reasonable (not truncated, not empty)', () => {
    const prompt = buildSystemPrompt();
    expect(prompt.length).toBeGreaterThan(500);
    expect(prompt.length).toBeLessThan(100000);
  });
});
