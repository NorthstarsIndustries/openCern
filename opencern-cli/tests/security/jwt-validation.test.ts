import { describe, it, expect, beforeAll } from 'vitest';
import { createHmac } from 'crypto';

const JWT_SECRET = 'test-jwt-secret-for-opencern';

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4 !== 0) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  header: Record<string, string> = { alg: 'HS256', typ: 'JWT' },
): string {
  const headerEnc = base64UrlEncode(JSON.stringify(header));
  const payloadEnc = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerEnc}.${payloadEnc}`;
  const sig = createHmac('sha256', secret).update(data).digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${data}.${sig}`;
}

interface JwtValidationResult {
  valid: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

function verifyJwt(token: string, secret: string): JwtValidationResult {
  if (!token) {
    return { valid: false, error: 'Missing JWT' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid JWT format' };
  }

  const [headerEnc, payloadEnc, signature] = parts;

  const expectedSig = createHmac('sha256', secret)
    .update(`${headerEnc}.${payloadEnc}`)
    .digest('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  if (signature !== expectedSig) {
    return { valid: false, error: 'Invalid signature' };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(payloadEnc));
  } catch {
    return { valid: false, error: 'Invalid payload' };
  }

  if (payload.exp && typeof payload.exp === 'number') {
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'Token expired' };
    }
  }

  if (payload.iss && payload.iss !== 'opencern-cli') {
    return { valid: false, error: 'Invalid issuer' };
  }

  return { valid: true, payload };
}

describe('JWT Validation', () => {
  let validToken: string;
  const validPayload = {
    sub: 'testuser',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    iss: 'opencern-cli',
  };

  beforeAll(() => {
    validToken = signJwt(validPayload, JWT_SECRET);
  });

  describe('valid JWT', () => {
    it('decodes a valid token correctly', () => {
      const result = verifyJwt(validToken, JWT_SECRET);
      expect(result.valid).toBe(true);
      expect(result.payload?.sub).toBe('testuser');
      expect(result.payload?.iss).toBe('opencern-cli');
    });

    it('preserves all payload fields', () => {
      const result = verifyJwt(validToken, JWT_SECRET);
      expect(result.payload).toMatchObject({
        sub: 'testuser',
        iss: 'opencern-cli',
      });
      expect(result.payload?.iat).toBeTypeOf('number');
      expect(result.payload?.exp).toBeTypeOf('number');
    });
  });

  describe('expired JWT', () => {
    it('rejects an expired token', () => {
      const expiredPayload = {
        sub: 'testuser',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
        iss: 'opencern-cli',
      };
      const expired = signJwt(expiredPayload, JWT_SECRET);
      const result = verifyJwt(expired, JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token expired');
    });
  });

  describe('tampered JWT', () => {
    it('detects a modified payload', () => {
      const parts = validToken.split('.');
      const payload = JSON.parse(base64UrlDecode(parts[1]));
      payload.sub = 'admin';
      parts[1] = base64UrlEncode(JSON.stringify(payload));
      const tampered = parts.join('.');

      const result = verifyJwt(tampered, JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('detects a modified header', () => {
      const parts = validToken.split('.');
      const header = JSON.parse(base64UrlDecode(parts[0]));
      header.alg = 'none';
      parts[0] = base64UrlEncode(JSON.stringify(header));
      const tampered = parts.join('.');

      const result = verifyJwt(tampered, JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('rejects token signed with different secret', () => {
      const wrongToken = signJwt(validPayload, 'wrong-secret');
      const result = verifyJwt(wrongToken, JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });
  });

  describe('missing JWT', () => {
    it('returns unauthenticated for empty string', () => {
      const result = verifyJwt('', JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing JWT');
    });

    it('rejects malformed token (no dots)', () => {
      const result = verifyJwt('not-a-jwt', JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JWT format');
    });

    it('rejects token with too few parts', () => {
      const result = verifyJwt('header.payload', JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid JWT format');
    });
  });

  describe('wrong issuer', () => {
    it('rejects a JWT with wrong issuer', () => {
      const badIssuerPayload = {
        sub: 'testuser',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'evil-service',
      };
      const token = signJwt(badIssuerPayload, JWT_SECRET);
      const result = verifyJwt(token, JWT_SECRET);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid issuer');
    });
  });

  describe('token structure matches cli-auth worker format', () => {
    it('produces a three-part dot-separated string', () => {
      expect(validToken.split('.').length).toBe(3);
    });

    it('header contains alg and typ', () => {
      const header = JSON.parse(base64UrlDecode(validToken.split('.')[0]));
      expect(header.alg).toBe('HS256');
      expect(header.typ).toBe('JWT');
    });

    it('payload contains sub, iat, exp, iss', () => {
      const payload = JSON.parse(base64UrlDecode(validToken.split('.')[1]));
      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iss');
    });
  });
});
