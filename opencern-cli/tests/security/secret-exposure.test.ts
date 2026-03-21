import { describe, it, expect, vi, beforeEach } from 'vitest';

function maskKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

const SAMPLE_KEYS = {
  anthropic: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  ibmQuantum: 'ibm-q-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  generic: 'opencern-token-abcdefghijklmnopqrstuvwxyz1234567890',
};

describe('Secret Exposure Prevention', () => {
  describe('maskKey function', () => {
    it('masks a long API key showing first 6 and last 4 chars', () => {
      const masked = maskKey(SAMPLE_KEYS.anthropic);
      expect(masked).toBe('sk-ant...xxxx');
      expect(masked).not.toBe(SAMPLE_KEYS.anthropic);
      expect(masked.length).toBeLessThan(SAMPLE_KEYS.anthropic.length);
    });

    it('masks IBM Quantum key', () => {
      const masked = maskKey(SAMPLE_KEYS.ibmQuantum);
      expect(masked.startsWith('ibm-q-')).toBe(true);
      expect(masked).toContain('...');
      expect(masked).not.toBe(SAMPLE_KEYS.ibmQuantum);
    });

    it('returns **** for empty string', () => {
      expect(maskKey('')).toBe('****');
    });

    it('returns **** for short keys (< 8 chars)', () => {
      expect(maskKey('abc')).toBe('****');
      expect(maskKey('1234567')).toBe('****');
    });

    it('masks exactly 8-char key', () => {
      const result = maskKey('12345678');
      expect(result).toBe('123456...5678');
    });

    it('never exposes the full key in output', () => {
      for (const key of Object.values(SAMPLE_KEYS)) {
        const masked = maskKey(key);
        expect(masked).not.toBe(key);
      }
    });
  });

  describe('history does not store sensitive commands', () => {
    const SENSITIVE_PATTERNS = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i,
      /bearer\s+\S+/i,
      /sk-ant-/i,
    ];

    function shouldOmitFromHistory(command: string): boolean {
      return SENSITIVE_PATTERNS.some(p => p.test(command));
    }

    it('flags /keys set commands as sensitive', () => {
      expect(shouldOmitFromHistory('/keys set anthropic sk-ant-api03-xxx')).toBe(true);
    });

    it('flags token-containing commands', () => {
      expect(shouldOmitFromHistory('export TOKEN=abc123')).toBe(true);
    });

    it('flags password-containing commands', () => {
      expect(shouldOmitFromHistory('login --password=s3cret')).toBe(true);
    });

    it('allows normal commands', () => {
      expect(shouldOmitFromHistory('/datasets')).toBe(false);
      expect(shouldOmitFromHistory('/download cms 2016')).toBe(false);
      expect(shouldOmitFromHistory('/status')).toBe(false);
    });
  });

  describe('config output masks secret values', () => {
    function buildConfigDisplay(items: { label: string; value: string; type: string }[]): string[] {
      return items.map(item => {
        const displayValue = item.type === 'secret' ? maskKey(item.value) : item.value;
        return `${item.label}: ${displayValue}`;
      });
    }

    it('masks secret-type config values in display', () => {
      const items = [
        { label: 'Anthropic API Key', value: SAMPLE_KEYS.anthropic, type: 'secret' },
        { label: 'Data Directory', value: '~/opencern-datasets', type: 'string' },
      ];
      const display = buildConfigDisplay(items);
      expect(display[0]).not.toContain(SAMPLE_KEYS.anthropic);
      expect(display[0]).toContain('...');
      expect(display[1]).toContain('~/opencern-datasets');
    });

    it('never includes full API key in config output', () => {
      const items = [
        { label: 'Anthropic', value: SAMPLE_KEYS.anthropic, type: 'secret' },
        { label: 'IBM Quantum', value: SAMPLE_KEYS.ibmQuantum, type: 'secret' },
      ];
      const display = buildConfigDisplay(items);
      const joined = display.join('\n');
      expect(joined).not.toContain(SAMPLE_KEYS.anthropic);
      expect(joined).not.toContain(SAMPLE_KEYS.ibmQuantum);
    });
  });

  describe('keystore encrypts at rest', () => {
    it('encrypted output is not plain text', () => {
      const { createCipheriv, randomBytes, scryptSync } = require('crypto');
      const passphrase = 'opencern-local-keystore-v1';
      const key = scryptSync(passphrase, 'opencern-salt-v1', 32);
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', key, iv);

      const sensitiveData = JSON.stringify({ 'anthropic': SAMPLE_KEYS.anthropic });
      const encrypted = Buffer.concat([cipher.update(sensitiveData, 'utf-8'), cipher.final()]);
      const stored = JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex') });

      expect(stored).not.toContain(SAMPLE_KEYS.anthropic);
      expect(stored).not.toContain('sk-ant');
    });

    it('encrypted data can be decrypted with correct key', () => {
      const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require('crypto');
      const passphrase = 'opencern-local-keystore-v1';
      const key = scryptSync(passphrase, 'opencern-salt-v1', 32);
      const iv = randomBytes(16);

      const original = JSON.stringify({ 'anthropic': SAMPLE_KEYS.anthropic });
      const cipher = createCipheriv('aes-256-cbc', key, iv);
      const encrypted = Buffer.concat([cipher.update(original, 'utf-8'), cipher.final()]);

      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      expect(decrypted.toString('utf-8')).toBe(original);
    });

    it('wrong key cannot decrypt data', () => {
      const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require('crypto');
      const key = scryptSync('opencern-local-keystore-v1', 'opencern-salt-v1', 32);
      const wrongKey = scryptSync('wrong-passphrase', 'opencern-salt-v1', 32);
      const iv = randomBytes(16);

      const cipher = createCipheriv('aes-256-cbc', key, iv);
      const encrypted = Buffer.concat([cipher.update('secret data', 'utf-8'), cipher.final()]);

      const decipher = createDecipheriv('aes-256-cbc', wrongKey, iv);
      expect(() => {
        Buffer.concat([decipher.update(encrypted), decipher.final()]);
      }).toThrow();
    });
  });
});
