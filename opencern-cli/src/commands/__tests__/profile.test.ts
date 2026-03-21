import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/keystore.js', () => ({
  getKey: vi.fn(),
  setKey: vi.fn(),
  hasKey: vi.fn(),
  maskKey: vi.fn((k: string) => (k && k.length >= 8 ? `${k.slice(0, 6)}...${k.slice(-4)}` : '****')),
}));
vi.mock('../../utils/auth.js', () => ({
  isAuthenticated: vi.fn(),
}));
vi.mock('../../utils/config.js', () => ({
  config: {
    get: vi.fn((k: string) => {
      if (k === 'defaultModel') return 'claude-sonnet-4-6';
      if (k === 'dataDir') return '/tmp/opencern-datasets';
      return undefined;
    }),
  },
}));

import { getKey, setKey, hasKey } from '../../utils/keystore.js';
import { isAuthenticated } from '../../utils/auth.js';
import { getProfile, setProfileField, formatProfile, exportProfile } from '../profile.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProfile', () => {
  it('should return a complete profile object', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getKey).mockReturnValue('testuser');
    vi.mocked(hasKey).mockReturnValue(true);

    const profile = getProfile();

    expect(profile).toHaveProperty('username');
    expect(profile).toHaveProperty('authenticated');
    expect(profile).toHaveProperty('defaultModel');
    expect(profile.authenticated).toBe(true);
  });

  it('should handle unauthenticated user', () => {
    vi.mocked(isAuthenticated).mockReturnValue(false);
    vi.mocked(getKey).mockReturnValue(null);
    vi.mocked(hasKey).mockReturnValue(false);

    const profile = getProfile();

    expect(profile.authenticated).toBe(false);
  });
});

describe('setProfileField', () => {
  it('should set display name', () => {
    const result = setProfileField('display-name', 'John Doe');
    expect(result.success).toBe(true);
    expect(vi.mocked(setKey)).toHaveBeenCalled();
  });

  it('should set email', () => {
    const result = setProfileField('email', 'john@example.com');
    expect(result.success).toBe(true);
  });

  it('should set organization', () => {
    const result = setProfileField('org', 'CERN');
    expect(result.success).toBe(true);
  });

  it('should reject unknown fields', () => {
    const result = setProfileField('unknown-field', 'value');
    expect(result.success).toBe(false);
  });
});

describe('formatProfile', () => {
  it('should return formatted profile lines', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getKey).mockReturnValue('testuser');
    vi.mocked(hasKey).mockReturnValue(true);

    const lines = formatProfile();
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('exportProfile', () => {
  it('should return valid JSON', () => {
    vi.mocked(isAuthenticated).mockReturnValue(true);
    vi.mocked(getKey).mockReturnValue('testuser');
    vi.mocked(hasKey).mockReturnValue(false);

    const json = exportProfile();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveProperty('username');
    expect(parsed).toHaveProperty('defaultModel');
  });
});
