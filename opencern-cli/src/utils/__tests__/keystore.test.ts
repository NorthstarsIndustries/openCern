import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), `opencern-keystore-test-${randomBytes(4).toString('hex')}`);
const KEYSTORE_FILE = join(TEST_DIR, 'keystore.enc');
const PASSPHRASE = 'opencern-local-keystore-v1';

function deriveKey(): Buffer {
  return scryptSync(PASSPHRASE, 'opencern-salt-v1', 32);
}

function encryptFile(data: Record<string, string>): void {
  const key = deriveKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf-8'), cipher.final()]);
  writeFileSync(KEYSTORE_FILE, JSON.stringify({ iv: iv.toString('hex'), data: encrypted.toString('hex') }));
}

function decryptFile(): Record<string, string> {
  if (!existsSync(KEYSTORE_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(KEYSTORE_FILE, 'utf-8'));
    const key = deriveKey();
    const iv = Buffer.from(raw.iv, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(raw.data, 'hex')), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8'));
  } catch {
    return {};
  }
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('file keystore', () => {
  it('should return empty object when no keystore exists', () => {
    expect(decryptFile()).toEqual({});
  });

  it('should encrypt and decrypt a key', () => {
    encryptFile({ anthropic: 'sk-ant-test-123' });
    const store = decryptFile();
    expect(store.anthropic).toBe('sk-ant-test-123');
  });

  it('should store multiple keys', () => {
    encryptFile({
      anthropic: 'sk-ant-test',
      'quantum-ibm': 'ibm-token-xyz',
    });
    const store = decryptFile();
    expect(store.anthropic).toBe('sk-ant-test');
    expect(store['quantum-ibm']).toBe('ibm-token-xyz');
  });

  it('should handle corrupted keystore gracefully', () => {
    writeFileSync(KEYSTORE_FILE, 'not valid json');
    expect(decryptFile()).toEqual({});
  });

  it('should overwrite existing keys', () => {
    encryptFile({ anthropic: 'old-key' });
    encryptFile({ anthropic: 'new-key' });
    const store = decryptFile();
    expect(store.anthropic).toBe('new-key');
  });

  it('should delete a key by omitting it', () => {
    encryptFile({ anthropic: 'key1', other: 'key2' });
    const store = decryptFile();
    delete store.anthropic;
    encryptFile(store);
    const updated = decryptFile();
    expect(updated.anthropic).toBeUndefined();
    expect(updated.other).toBe('key2');
  });
});

describe('maskKey', () => {
  function maskKey(key: string): string {
    if (!key || key.length < 8) return '****';
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  it('should mask keys correctly', () => {
    expect(maskKey('sk-ant-api-key-123456')).toBe('sk-ant...3456');
  });

  it('should handle short keys', () => {
    expect(maskKey('short')).toBe('****');
    expect(maskKey('')).toBe('****');
  });
});
