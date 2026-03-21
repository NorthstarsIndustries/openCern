import { describe, it, expect } from 'vitest';
import worker from '../index';

const RAW_BASE = 'https://raw.githubusercontent.com/NorthstarsIndustries/openCern/main/scripts';

function req(path: string): Request {
  return new Request(`https://opencern.northstarcorp.co${path}`);
}

describe('install worker', () => {
  describe('GET /install.sh', () => {
    it('redirects to GitHub raw install.sh', async () => {
      const res = await worker.fetch(req('/install.sh'));
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(`${RAW_BASE}/install.sh`);
    });
  });

  describe('GET /install-l.sh', () => {
    it('redirects to the same install.sh (Linux alias)', async () => {
      const res = await worker.fetch(req('/install-l.sh'));
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(`${RAW_BASE}/install.sh`);
    });
  });

  describe('GET /install-w.sh', () => {
    it('redirects to GitHub raw install-w.sh for Windows', async () => {
      const res = await worker.fetch(req('/install-w.sh'));
      expect(res.status).toBe(302);
      expect(res.headers.get('Location')).toBe(`${RAW_BASE}/install-w.sh`);
    });
  });

  describe('GET / (default text response)', () => {
    it('returns plain text install instructions', async () => {
      const res = await worker.fetch(req('/'));
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/plain');

      const text = await res.text();
      expect(text).toContain('OpenCERN CLI Installer');
      expect(text).toContain('curl -fsSL');
      expect(text).toContain('install.sh');
      expect(text).toContain('install-w.sh');
    });

    it('includes macOS/Linux and Windows instructions', async () => {
      const res = await worker.fetch(req('/'));
      const text = await res.text();
      expect(text).toContain('macOS / Linux');
      expect(text).toContain('Windows (Git Bash)');
    });
  });

  describe('unknown paths', () => {
    it('returns the default text response for unmatched paths', async () => {
      const res = await worker.fetch(req('/something-else'));
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/plain');
    });
  });
});
