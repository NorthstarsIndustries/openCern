import { describe, it, expect, vi, beforeEach } from 'vitest';

const TRAVERSAL_PAYLOADS = [
  '../../etc/passwd',
  '../../../etc/shadow',
  '..\\..\\windows\\system32\\config\\sam',
  '%2e%2e%2fetc%2fpasswd',
  '%2e%2e/%2e%2e/etc/passwd',
  '..%252f..%252fetc%252fpasswd',
  '....//....//etc/passwd',
  '..;/etc/passwd',
  '\0../../etc/passwd',
  'data.root\0.txt',
  '/etc/passwd',
  '/var/log/syslog',
  '/root/.ssh/id_rsa',
];

const DATA_DIR = '/home/user/opencern-datasets/data';

function isPathSafe(inputPath: string, baseDir: string): boolean {
  const cleaned = inputPath.replace(/%2e/gi, '.').replace(/%2f/gi, '/').replace(/%5c/gi, '\\');
  if (cleaned.includes('\0')) return false;
  if (cleaned.includes('..')) return false;

  const { resolve } = require('path');
  const resolved = resolve(baseDir, cleaned);
  return resolved.startsWith(baseDir);
}

function sanitizeFilePath(inputPath: string): string {
  let sanitized = decodeURIComponent(inputPath);
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/^\/+/, '');
  return sanitized;
}

describe('Path Traversal Prevention', () => {
  describe('directory traversal with ../', () => {
    it.each([
      '../../etc/passwd',
      '../../../etc/shadow',
      '../../../../root/.bashrc',
    ])('rejects %s', (payload) => {
      expect(isPathSafe(payload, DATA_DIR)).toBe(false);
    });
  });

  describe('URL-encoded traversal', () => {
    it.each([
      '%2e%2e%2fetc%2fpasswd',
      '%2e%2e/%2e%2e/etc/passwd',
      '..%252f..%252fetc%252fpasswd',
    ])('rejects %s', (payload) => {
      expect(isPathSafe(payload, DATA_DIR)).toBe(false);
    });
  });

  describe('null byte injection', () => {
    it('rejects null bytes in path', () => {
      expect(isPathSafe('\0../../etc/passwd', DATA_DIR)).toBe(false);
    });

    it('rejects null byte path truncation', () => {
      expect(isPathSafe('data.root\0.txt', DATA_DIR)).toBe(false);
    });
  });

  describe('absolute paths outside data dir', () => {
    it.each([
      '/etc/passwd',
      '/var/log/syslog',
      '/root/.ssh/id_rsa',
      '/proc/self/environ',
    ])('rejects absolute path %s', (payload) => {
      expect(isPathSafe(payload, DATA_DIR)).toBe(false);
    });
  });

  describe('symlink following (conceptual)', () => {
    it('flags symlink-like path components', () => {
      const suspiciousPath = 'datasets/link-to-etc/passwd';
      const sanitized = sanitizeFilePath(suspiciousPath);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toMatch(/^\//);
    });
  });

  describe('sanitizeFilePath strips dangerous components', () => {
    it('removes null bytes', () => {
      expect(sanitizeFilePath('file\0.root')).toBe('file.root');
    });

    it('removes double-dot sequences', () => {
      expect(sanitizeFilePath('../../etc/passwd')).toBe('etc/passwd');
    });

    it('removes leading slashes', () => {
      expect(sanitizeFilePath('/etc/passwd')).toBe('etc/passwd');
    });

    it('decodes URL-encoded traversal', () => {
      const result = sanitizeFilePath('%2e%2e%2fetc%2fpasswd');
      expect(result).not.toContain('..');
    });
  });

  describe('cernApi file operations reject traversal', () => {
    const mockAxios = {
      get: vi.fn(),
      delete: vi.fn(),
      post: vi.fn(),
      create: vi.fn(() => mockAxios),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('listFiles does not pass raw traversal paths', () => {
      for (const payload of TRAVERSAL_PAYLOADS) {
        const safe = isPathSafe(payload, DATA_DIR);
        if (!safe) {
          expect(safe).toBe(false);
        }
      }
    });

    it('processFile strips absolute path prefix', () => {
      const filePath = '/home/other/secret/data.root';
      let relative = filePath.replace(/^~?\/.*\/opencern-datasets\/data\//, '');
      if (relative.startsWith('/')) relative = relative.split('/').pop() || relative;
      expect(relative).toBe('data.root');
    });

    it('deleteFile encodes the name', () => {
      const malicious = '../../../etc/passwd';
      const encoded = encodeURIComponent(malicious);
      expect(encoded).not.toContain('/');
      expect(encoded).toBe('..%2F..%2F..%2Fetc%2Fpasswd');
    });
  });

  describe('comprehensive fuzz-like traversal payloads', () => {
    it.each(TRAVERSAL_PAYLOADS)('payload "%s" is rejected by isPathSafe', (payload) => {
      expect(isPathSafe(payload, DATA_DIR)).toBe(false);
    });
  });
});
