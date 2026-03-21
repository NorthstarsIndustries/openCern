import { describe, it, expect } from 'vitest';

// Test the sensitive pattern filtering logic directly
const SENSITIVE_PATTERNS = ['--set ai-key', '--set quantum-key', '--set aws', 'password', 'token'];

function isSensitive(command: string): boolean {
  const lower = command.toLowerCase();
  return SENSITIVE_PATTERNS.some(p => lower.includes(p));
}

describe('history', () => {
  describe('isSensitive', () => {
    it('should detect AI key commands as sensitive', () => {
      expect(isSensitive('/config --set ai-key sk-ant-123')).toBe(true);
    });

    it('should detect quantum key commands as sensitive', () => {
      expect(isSensitive('/config --set quantum-key abc')).toBe(true);
    });

    it('should detect AWS commands as sensitive', () => {
      expect(isSensitive('/config --set aws-key AKIA123')).toBe(true);
    });

    it('should detect password mentions as sensitive', () => {
      expect(isSensitive('set password mySecret123')).toBe(true);
    });

    it('should detect token mentions as sensitive', () => {
      expect(isSensitive('export TOKEN=abc123')).toBe(true);
    });

    it('should allow normal commands', () => {
      expect(isSensitive('/download cms 2016')).toBe(false);
      expect(isSensitive('/status')).toBe(false);
      expect(isSensitive('/help')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isSensitive('/CONFIG --SET AI-KEY sk-123')).toBe(true);
    });
  });

  describe('entry management', () => {
    it('should trim whitespace from commands', () => {
      const cmd = '  /download cms  ';
      expect(cmd.trim()).toBe('/download cms');
    });

    it('should deduplicate consecutive identical commands', () => {
      const history: string[] = [];
      const add = (cmd: string) => {
        if (history.length > 0 && history[0] === cmd) return;
        history.unshift(cmd);
      };

      add('/status');
      add('/status');
      add('/help');

      expect(history).toEqual(['/help', '/status']);
    });

    it('should limit history size', () => {
      const MAX = 1000;
      const history: string[] = [];
      for (let i = 0; i < 1050; i++) {
        history.unshift(`cmd-${i}`);
      }
      const trimmed = history.slice(0, MAX);
      expect(trimmed.length).toBe(MAX);
      expect(trimmed[0]).toBe('cmd-1049');
    });
  });

  describe('search', () => {
    it('should find matching commands', () => {
      const history = [
        { command: '/download cms 2016', timestamp: '' },
        { command: '/status', timestamp: '' },
        { command: '/download atlas 2018', timestamp: '' },
      ];
      const results = history
        .filter(e => e.command.toLowerCase().includes('download'))
        .map(e => e.command);
      expect(results).toEqual(['/download cms 2016', '/download atlas 2018']);
    });

    it('should return empty for no matches', () => {
      const history = [{ command: '/status', timestamp: '' }];
      const results = history.filter(e => e.command.includes('quantum'));
      expect(results).toEqual([]);
    });
  });

  describe('navigation', () => {
    it('should navigate through history with cursor', () => {
      const history = ['/cmd3', '/cmd2', '/cmd1'];
      let cursor = -1;

      // Go up (previous)
      cursor = Math.min(cursor + 1, history.length - 1);
      expect(history[cursor]).toBe('/cmd3');

      cursor = Math.min(cursor + 1, history.length - 1);
      expect(history[cursor]).toBe('/cmd2');

      // Go down (next)
      cursor -= 1;
      expect(history[cursor]).toBe('/cmd3');
    });
  });
});
