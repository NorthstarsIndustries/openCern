import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../index';
import type { Env } from '../index';

function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiration?: number }>();
  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiration && Date.now() / 1000 > entry.expiration) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, {
        value,
        expiration: opts?.expirationTtl ? Date.now() / 1000 + opts.expirationTtl : undefined,
      });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as unknown as KVNamespace;
}

function createEnv(kvOverride?: KVNamespace): Env {
  return {
    CLI_AUTH_CODES: kvOverride ?? createMockKV(),
    JWT_SECRET: 'test-secret-key-for-jwt-signing',
  };
}

function req(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return new Request(`https://auth.opencern.io${path}`, init);
}

async function json(res: Response) {
  return res.json();
}

describe('cli-auth worker', () => {
  let env: Env;
  let kv: KVNamespace;

  beforeEach(() => {
    kv = createMockKV();
    env = createEnv(kv);
  });

  describe('POST /auth/cli/init', () => {
    it('returns a code, expiresAt, pollUrl, and authUrl', async () => {
      const res = await worker.fetch(req('POST', '/auth/cli/init'), env);
      expect(res.status).toBe(200);

      const data = await json(res);
      expect(data.code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(data.expiresAt).toBeDefined();
      expect(data.pollUrl).toBe(`/auth/cli/poll?code=${data.code}`);
      expect(data.authUrl).toBe(`https://app.opencern.io/auth/cli?code=${data.code}`);
    });

    it('stores the code in KV with TTL', async () => {
      await worker.fetch(req('POST', '/auth/cli/init'), env);
      expect(kv.put).toHaveBeenCalledWith(
        expect.stringMatching(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/),
        expect.any(String),
        { expirationTtl: 300 },
      );
    });
  });

  describe('GET /auth/cli/poll', () => {
    it('returns pending status for a fresh code', async () => {
      const initRes = await worker.fetch(req('POST', '/auth/cli/init'), env);
      const { code } = await json(initRes);

      const res = await worker.fetch(req('GET', `/auth/cli/poll?code=${code}`), env);
      const data = await json(res);
      expect(data.status).toBe('pending');
      expect(data.token).toBeUndefined();
    });

    it('returns authorized status with token after authorization', async () => {
      const initRes = await worker.fetch(req('POST', '/auth/cli/init'), env);
      const { code } = await json(initRes);

      await worker.fetch(req('POST', '/auth/cli/authorize', { code, username: 'alice' }), env);

      const res = await worker.fetch(req('GET', `/auth/cli/poll?code=${code}`), env);
      const data = await json(res);
      expect(data.status).toBe('authorized');
      expect(data.token).toBeDefined();
      expect(data.username).toBe('alice');
    });

    it('returns expired when code is not in KV', async () => {
      const res = await worker.fetch(req('GET', '/auth/cli/poll?code=ZZZZ-ZZZZ'), env);
      const data = await json(res);
      expect(data.status).toBe('expired');
    });

    it('returns 400 when code query param is missing', async () => {
      const res = await worker.fetch(req('GET', '/auth/cli/poll'), env);
      expect(res.status).toBe(400);
      const data = await json(res);
      expect(data.error).toBe('Missing code');
    });
  });

  describe('POST /auth/cli/authorize', () => {
    it('authorizes a valid pending code and issues a JWT', async () => {
      const initRes = await worker.fetch(req('POST', '/auth/cli/init'), env);
      const { code } = await json(initRes);

      const res = await worker.fetch(
        req('POST', '/auth/cli/authorize', { code, username: 'bob' }),
        env,
      );
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.ok).toBe(true);

      // Verify KV was updated with token
      const raw = await kv.get(code);
      expect(raw).toBeTruthy();
      const entry = JSON.parse(raw as string);
      expect(entry.status).toBe('authorized');
      expect(entry.token).toBeDefined();
      expect(entry.username).toBe('bob');

      // Verify JWT structure (three dot-separated base64url segments)
      expect(entry.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('returns 400 when code is missing', async () => {
      const res = await worker.fetch(
        req('POST', '/auth/cli/authorize', { username: 'bob' }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when username is missing', async () => {
      const res = await worker.fetch(
        req('POST', '/auth/cli/authorize', { code: 'AAAA-BBBB' }),
        env,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const rawReq = new Request('https://auth.opencern.io/auth/cli/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const res = await worker.fetch(rawReq, env);
      expect(res.status).toBe(400);
    });

    it('returns 404 when code has expired / not found', async () => {
      const res = await worker.fetch(
        req('POST', '/auth/cli/authorize', { code: 'GONE-CODE', username: 'bob' }),
        env,
      );
      expect(res.status).toBe(404);
      const data = await json(res);
      expect(data.error).toMatch(/expired|not found/i);
    });

    it('returns 409 when code was already authorized', async () => {
      const initRes = await worker.fetch(req('POST', '/auth/cli/init'), env);
      const { code } = await json(initRes);

      await worker.fetch(req('POST', '/auth/cli/authorize', { code, username: 'alice' }), env);

      const res = await worker.fetch(
        req('POST', '/auth/cli/authorize', { code, username: 'eve' }),
        env,
      );
      expect(res.status).toBe(409);
      const data = await json(res);
      expect(data.error).toMatch(/already used/i);
    });
  });

  describe('POST /auth/cli/revoke', () => {
    it('deletes the code from KV', async () => {
      const initRes = await worker.fetch(req('POST', '/auth/cli/init'), env);
      const { code } = await json(initRes);

      const res = await worker.fetch(req('POST', `/auth/cli/revoke?code=${code}`), env);
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.ok).toBe(true);

      expect(kv.delete).toHaveBeenCalledWith(code);
    });

    it('returns ok even without a code param', async () => {
      const res = await worker.fetch(req('POST', '/auth/cli/revoke'), env);
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.ok).toBe(true);
    });
  });

  describe('GET /auth/cli (HTML auth page)', () => {
    it('returns HTML containing the code for a valid pending code', async () => {
      const initRes = await worker.fetch(req('POST', '/auth/cli/init'), env);
      const { code } = await json(initRes);

      const res = await worker.fetch(req('GET', `/auth/cli?code=${code}`), env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/html');

      const html = await res.text();
      expect(html).toContain(code);
      expect(html).toContain('CLI Authorization');
    });

    it('returns expired page when code is not in KV', async () => {
      const res = await worker.fetch(req('GET', '/auth/cli?code=XXXX-YYYY'), env);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain('expired');
      expect(html).toContain('XXXX-YYYY');
    });

    it('returns 400 when code param is missing', async () => {
      const res = await worker.fetch(req('GET', '/auth/cli'), env);
      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Missing code');
    });
  });

  describe('GET / (health check)', () => {
    it('returns service info JSON', async () => {
      const res = await worker.fetch(req('GET', '/'), env);
      expect(res.status).toBe(200);

      const data = await json(res);
      expect(data.service).toBe('opencern-cli-auth');
      expect(data.status).toBe('ok');
      expect(data.version).toBeDefined();
      expect(data.endpoints).toBeInstanceOf(Array);
      expect(data.endpoints).toContain('/auth/cli/init');
    });
  });

  describe('OPTIONS (CORS preflight)', () => {
    it('returns proper CORS headers', async () => {
      const res = await worker.fetch(req('OPTIONS', '/auth/cli/init'), env);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
      expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });

  describe('unknown routes', () => {
    it('returns 404 for unmatched paths', async () => {
      const res = await worker.fetch(req('GET', '/nope'), env);
      expect(res.status).toBe(404);
      const data = await json(res);
      expect(data.error).toBe('Not found');
    });

    it('returns 404 for wrong method on known path', async () => {
      const res = await worker.fetch(req('DELETE', '/auth/cli/init'), env);
      expect(res.status).toBe(404);
    });
  });

  describe('CORS on JSON responses', () => {
    it('includes CORS headers on all JSON responses', async () => {
      const res = await worker.fetch(req('GET', '/'), env);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
