import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../keystore.js', () => ({
  getKey: vi.fn(),
  hasKey: vi.fn(),
  deleteKey: vi.fn(),
}));

import { getKey, hasKey, deleteKey } from '../keystore.js';
import { getToken, isAuthenticated, requireAuth, clearToken } from '../auth.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getToken', () => {
  it('should return token from keystore', () => {
    vi.mocked(getKey).mockReturnValue('jwt-token-123');

    expect(getToken()).toBe('jwt-token-123');
    expect(getKey).toHaveBeenCalledWith('opencern-token');
  });

  it('should return null when no token exists', () => {
    vi.mocked(getKey).mockReturnValue(null);

    expect(getToken()).toBeNull();
  });
});

describe('isAuthenticated', () => {
  it('should return true when token exists', () => {
    vi.mocked(hasKey).mockReturnValue(true);

    expect(isAuthenticated()).toBe(true);
  });

  it('should return false when no token', () => {
    vi.mocked(hasKey).mockReturnValue(false);

    expect(isAuthenticated()).toBe(false);
  });
});

describe('requireAuth', () => {
  it('should return token when authenticated', () => {
    vi.mocked(getKey).mockReturnValue('valid-token');
    vi.mocked(hasKey).mockReturnValue(true);

    expect(requireAuth()).toBe('valid-token');
  });

  it('should throw when not authenticated', () => {
    vi.mocked(getKey).mockReturnValue(null);
    vi.mocked(hasKey).mockReturnValue(false);

    expect(() => requireAuth()).toThrow();
  });
});

describe('clearToken', () => {
  it('should delete token from keystore', () => {
    clearToken();

    expect(deleteKey).toHaveBeenCalledWith('opencern-token');
  });
});
