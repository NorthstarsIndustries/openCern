import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));
vi.mock('os', () => ({
  platform: vi.fn(() => 'darwin'),
}));

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { platform } from 'os';
import { checkDesktopApp, openViz, renderASCII } from '../viz.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkDesktopApp', () => {
  it('should detect macOS desktop app', () => {
    vi.mocked(platform).mockReturnValue('darwin' as any);
    vi.mocked(existsSync).mockReturnValue(true);

    expect(checkDesktopApp()).toBe(true);
  });

  it('should return false when app not installed on macOS', () => {
    vi.mocked(platform).mockReturnValue('darwin' as any);
    vi.mocked(existsSync).mockReturnValue(false);

    expect(checkDesktopApp()).toBe(false);
  });

  it('should check PATH on non-macOS platforms', () => {
    vi.mocked(platform).mockReturnValue('linux' as any);
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });

    expect(checkDesktopApp()).toBe(false);
  });
});

describe('openViz', () => {
  it('should prefer desktop app when available', () => {
    vi.mocked(platform).mockReturnValue('darwin' as any);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    const result = openViz('/data/events.json');

    expect(result.method).toBe('desktop');
  });

  it('should fall back to browser', () => {
    vi.mocked(platform).mockReturnValue('darwin' as any);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    const result = openViz('/data/events.json');

    expect(['browser', 'ascii']).toContain(result.method);
  });

  it('should use browser when forceBrowser is true', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(execSync).mockReturnValue(Buffer.from(''));

    const result = openViz('/data/events.json', true);

    expect(result.method).toBe('browser');
  });
});

describe('renderASCII', () => {
  it('should render ASCII visualization from JSON events', () => {
    const events = {
      events: [
        { particles: [{ pt: 45, eta: -1.1, phi: 2.3 }, { pt: 30, eta: 0.5, phi: -1.0 }] },
      ],
    };
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(events));

    const lines = renderASCII('/data/events.json');

    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('should handle empty events', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ events: [] }));

    const lines = renderASCII('/data/empty.json');
    expect(Array.isArray(lines)).toBe(true);
  });

  it('should handle missing file', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const lines = renderASCII('/nonexistent.json');
    expect(Array.isArray(lines)).toBe(true);
  });
});
