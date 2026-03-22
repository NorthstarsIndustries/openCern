import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));
vi.mock('os', () => ({
  platform: vi.fn(() => 'darwin'),
}));

vi.mock('axios', () => {
  const post = vi.fn();
  const get = vi.fn();
  return { default: { post, get } };
});

vi.mock('../../utils/keystore.js', () => ({
  setKey: vi.fn(),
  deleteKey: vi.fn(),
  getKey: vi.fn(),
}));

import axios from 'axios';
import { setKey, deleteKey, getKey } from '../../utils/keystore.js';
import { login, logout, getUsername } from '../auth.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function flushAsync(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
  await vi.advanceTimersByTimeAsync(0);
}

describe('login', () => {
  it('should initiate device code flow and return success on authorization', async () => {
    const onCode = vi.fn();
    const onWaiting = vi.fn();

    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { code: 'ABCD1234', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    } as any);

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { status: 'authorized', token: 'jwt-token-xyz', username: 'testuser' },
    } as any);

    const loginPromise = login(onCode, onWaiting, { pollIntervalMs: 1, maxPollAttempts: 5 });

    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(10);
    }

    const result = await loginPromise;

    expect(onCode).toHaveBeenCalledWith('ABCD1234', expect.stringContaining('ABCD1234'));
    expect(result.success).toBe(true);
    expect(result.username).toBe('testuser');
    expect(vi.mocked(setKey)).toHaveBeenCalledWith('opencern-token', 'jwt-token-xyz');
    expect(vi.mocked(setKey)).toHaveBeenCalledWith('opencern-username', 'testuser');
  });

  it('should return error when init request fails', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Network error'));

    const result = await login(vi.fn(), vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle poll returning expired status', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { code: 'EXPIRED', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    } as any);

    vi.mocked(axios.get).mockResolvedValue({ data: { status: 'expired' } } as any);

    const loginPromise = login(vi.fn(), vi.fn(), { pollIntervalMs: 1, maxPollAttempts: 2 });

    for (let i = 0; i < 30; i++) {
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(0);
    }

    const result = await loginPromise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('expired');
  }, 120000);
});

describe('logout', () => {
  it('should revoke token and clear keystore', async () => {
    vi.mocked(getKey).mockReturnValue('some-token');
    vi.mocked(axios.post).mockResolvedValueOnce({ data: {} } as any);

    await logout();

    expect(vi.mocked(deleteKey)).toHaveBeenCalledWith('opencern-token');
    expect(vi.mocked(deleteKey)).toHaveBeenCalledWith('opencern-username');
  });

  it('should clear keystore even if revoke fails', async () => {
    vi.mocked(getKey).mockReturnValue('some-token');
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Network error'));

    await logout();

    expect(vi.mocked(deleteKey)).toHaveBeenCalledWith('opencern-token');
  });
});

describe('getUsername', () => {
  it('should return stored username', () => {
    vi.useRealTimers();
    vi.mocked(getKey).mockReturnValue('testuser');
    expect(getUsername()).toBe('testuser');
  });

  it('should return null when no username stored', () => {
    vi.useRealTimers();
    vi.mocked(getKey).mockReturnValue(null);
    expect(getUsername()).toBeNull();
  });
});
