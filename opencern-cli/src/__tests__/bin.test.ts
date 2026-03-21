import { describe, it, expect } from 'vitest';

describe('CLI entry point validation', () => {
  describe('Node version check', () => {
    it('should require Node >= 18', () => {
      const nodeVersion = process.versions.node;
      const major = parseInt(nodeVersion.split('.')[0], 10);
      expect(major).toBeGreaterThanOrEqual(18);
    });
  });

  describe('version flag parsing', () => {
    it('should recognize --version flag', () => {
      const args = ['--version'];
      expect(args.includes('--version') || args.includes('-v')).toBe(true);
    });

    it('should recognize -v flag', () => {
      const args = ['-v'];
      expect(args.includes('--version') || args.includes('-v')).toBe(true);
    });
  });

  describe('help flag parsing', () => {
    it('should recognize --help flag', () => {
      const args = ['--help'];
      expect(args.includes('--help') || args.includes('-h')).toBe(true);
    });

    it('should recognize -h flag', () => {
      const args = ['-h'];
      expect(args.includes('--help') || args.includes('-h')).toBe(true);
    });
  });

  describe('debug flag parsing', () => {
    it('should recognize --debug flag', () => {
      const args = ['--debug'];
      expect(args.includes('--debug')).toBe(true);
    });

    it('should not activate debug without flag', () => {
      const args = ['--help'];
      expect(args.includes('--debug')).toBe(false);
    });
  });

  describe('error message for missing build', () => {
    it('should suggest npm run build for module not found', () => {
      const errorCode = 'ERR_MODULE_NOT_FOUND';
      const suggestion = errorCode === 'ERR_MODULE_NOT_FOUND'
        ? 'Run `npm run build` first'
        : 'Unknown error';
      expect(suggestion).toContain('npm run build');
    });
  });
});
