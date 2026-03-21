import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env } from '../index';

const mockVerify = vi.fn();
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: mockVerify,
  })),
}));

const env: Env = {
  CLERK_WEBHOOK_SECRET: 'whsec_test_secret',
  RESEND_API_KEY: 'rsk_test_key',
};

const mockCtx: ExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

function svixHeaders() {
  return {
    'svix-id': 'msg_test123',
    'svix-timestamp': String(Math.floor(Date.now() / 1000)),
    'svix-signature': 'v1,fakesig',
  };
}

function webhookRequest(
  path: string,
  payload: object,
  method = 'POST',
  headers?: Record<string, string>,
): Request {
  return new Request(`https://auth.opencern.io${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...svixHeaders(),
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

describe('auth-system worker', () => {
  let worker: typeof import('../index').default;

  beforeEach(async () => {
    vi.resetModules();
    mockVerify.mockReset();
    vi.stubGlobal('fetch', vi.fn());

    const mod = await import('../index');
    worker = mod.default;
  });

  describe('POST /api/webhooks/clerk — email.created', () => {
    it('sends email via Resend on valid email.created event', async () => {
      const payload = {
        type: 'email.created',
        data: {
          to_email_address: 'user@example.com',
          subject: 'Your verification code',
          body: '<p>Code: 123456</p>',
        },
      };

      mockVerify.mockReturnValue(payload);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ id: 'email_abc' }), { status: 200 }),
      );

      const res = await worker.fetch(
        webhookRequest('/api/webhooks/clerk', payload),
        env,
        mockCtx,
      );

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('Webhook received properly');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          }),
          body: expect.stringContaining('user@example.com'),
        }),
      );
    });

    it('returns 500 when Resend API fails', async () => {
      const payload = {
        type: 'email.created',
        data: {
          to_email_address: 'fail@example.com',
          subject: 'Code',
          body: '<p>OTP</p>',
        },
      };

      mockVerify.mockReturnValue(payload);
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response('rate limit', { status: 429 }),
      );

      const res = await worker.fetch(
        webhookRequest('/api/webhooks/clerk', payload),
        env,
        mockCtx,
      );
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain('Failed to send email via Resend');
    });
  });

  describe('POST /api/webhooks/clerk — non email.created events', () => {
    it('returns 200 without sending email for user.created event', async () => {
      const payload = {
        type: 'user.created',
        data: { id: 'user_abc' },
      };

      mockVerify.mockReturnValue(payload);

      const res = await worker.fetch(
        webhookRequest('/api/webhooks/clerk', payload),
        env,
        mockCtx,
      );

      expect(res.status).toBe(200);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('returns 200 for session.created event', async () => {
      const payload = {
        type: 'session.created',
        data: { id: 'sess_abc' },
      };

      mockVerify.mockReturnValue(payload);

      const res = await worker.fetch(
        webhookRequest('/api/webhooks/clerk', payload),
        env,
        mockCtx,
      );
      expect(res.status).toBe(200);
    });
  });

  describe('signature verification', () => {
    it('returns 400 when Svix verification fails', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const res = await worker.fetch(
        webhookRequest('/api/webhooks/clerk', { type: 'email.created', data: {} }),
        env,
        mockCtx,
      );

      expect(res.status).toBe(400);
      const text = await res.text();
      expect(text).toContain('Webhook signature verification failed');
    });
  });

  describe('method and path guards', () => {
    it('returns 405 for GET request', async () => {
      const res = await worker.fetch(
        new Request('https://auth.opencern.io/api/webhooks/clerk', { method: 'GET' }),
        env,
        mockCtx,
      );
      expect(res.status).toBe(405);
    });

    it('returns 405 for POST to wrong path', async () => {
      const res = await worker.fetch(
        new Request('https://auth.opencern.io/api/other', {
          method: 'POST',
          body: '{}',
        }),
        env,
        mockCtx,
      );
      expect(res.status).toBe(405);
    });

    it('returns 405 for PUT request', async () => {
      const res = await worker.fetch(
        new Request('https://auth.opencern.io/api/webhooks/clerk', {
          method: 'PUT',
          body: '{}',
        }),
        env,
        mockCtx,
      );
      expect(res.status).toBe(405);
    });

    it('returns 405 for DELETE request', async () => {
      const res = await worker.fetch(
        new Request('https://auth.opencern.io/api/webhooks/clerk', { method: 'DELETE' }),
        env,
        mockCtx,
      );
      expect(res.status).toBe(405);
    });
  });
});
