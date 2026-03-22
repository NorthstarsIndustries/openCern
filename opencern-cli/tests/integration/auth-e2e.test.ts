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

vi.mock('../../src/utils/keystore.js', () => ({
  setKey: vi.fn(),
  deleteKey: vi.fn(),
  getKey: vi.fn(),
  hasKey: vi.fn(),
}));

import axios from 'axios';
import { setKey, deleteKey, getKey, hasKey } from '../../src/utils/keystore.js';
import { login, logout, getUsername } from '../../src/commands/auth.js';

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

describe('auth E2E flow', () => {
  it('should complete full login -> getUsername -> logout flow', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { code: 'TEST1234', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    } as any);

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { status: 'authorized', token: 'e2e-jwt-token', username: 'e2e-user' },
    } as any);

    const onCode = vi.fn();
    const onWaiting = vi.fn();
    const loginPromise = login(onCode, onWaiting, { pollIntervalMs: 1, maxPollAttempts: 5 });

    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(10);
    }

    const result = await loginPromise;

    expect(result.success).toBe(true);
    expect(result.username).toBe('e2e-user');
    expect(vi.mocked(setKey)).toHaveBeenCalledWith('opencern-token', 'e2e-jwt-token');

    vi.mocked(getKey).mockReturnValue('e2e-user');
    vi.useRealTimers();
    expect(getUsername()).toBe('e2e-user');

    vi.useFakeTimers();
    vi.mocked(getKey).mockReturnValue('e2e-jwt-token');
    vi.mocked(axios.post).mockResolvedValueOnce({ data: {} } as any);

    await logout();

    expect(vi.mocked(deleteKey)).toHaveBeenCalledWith('opencern-token');
    expect(vi.mocked(deleteKey)).toHaveBeenCalledWith('opencern-username');
  });

  it('should handle network failure during login gracefully', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('ENOTFOUND'));

    const result = await login(vi.fn(), vi.fn());

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('connect');
  });

  it('should handle timeout during polling', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { code: 'TIMEOUT', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    } as any);

    vi.mocked(axios.get).mockResolvedValue({ data: { status: 'pending' } } as any);

    const loginPromise = login(vi.fn(), vi.fn(), { pollIntervalMs: 1, maxPollAttempts: 3 });

    for (let i = 0; i < 20; i++) {
      await vi.advanceTimersByTimeAsync(10);
    }

    const result = await loginPromise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
  }, 20000);

  it('should handle logout when no token exists', async () => {
    vi.mocked(getKey).mockReturnValue(null);

    await logout();

    expect(vi.mocked(deleteKey)).toHaveBeenCalled();
  });
});
