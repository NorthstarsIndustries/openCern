/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */

import { execSync } from 'child_process';
import { platform } from 'os';
// Lazy-load axios to avoid follow-redirects initialization issues with Bun
const getAxios = () => import('axios').then(m => m.default);
import { setKey, deleteKey, getKey } from '../utils/keystore.js';

const CLI_AUTH_BASE = 'https://opencern-cli-auth.a-contactnaol.workers.dev';

export interface LoginResult {
  success: boolean;
  username?: string;
  error?: string;
}

function openBrowser(url: string): void {
  const p = platform();
  try {
    if (p === 'darwin') execSync(`open "${url}"`, { stdio: 'ignore' });
    else if (p === 'win32') execSync(`start "" "${url}"`, { stdio: 'ignore' });
    else execSync(`xdg-open "${url}"`, { stdio: 'ignore' });
  } catch { /* ignore */ }
}

export async function login(
  onCode: (code: string, url: string) => void,
  onWaiting: () => void
): Promise<LoginResult> {
  let initResult: { code: string; expiresAt: string };
  try {
    const res = await (await getAxios()).post(`${CLI_AUTH_BASE}/auth/cli/init`, {}, { timeout: 10000 });
    initResult = res.data as { code: string; expiresAt: string };
  } catch {
    return {
      success: false,
      error: 'Could not connect to OpenCERN auth service. Check your internet connection.',
    };
  }

  const { code } = initResult;
  const authUrl = `${CLI_AUTH_BASE}/auth/cli?code=${code}`;

  openBrowser(authUrl);
  onCode(code, authUrl);
  onWaiting();

  const deadline = Date.now() + 5 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const res = await (await getAxios()).get(`${CLI_AUTH_BASE}/auth/cli/poll`, {
        params: { code },
        timeout: 5000,
      });
      const { status, token, username } = res.data as {
        status: string;
        token?: string;
        username?: string;
      };
      if (status === 'authorized' && token) {
        setKey('opencern-token', token);
        if (username) setKey('opencern-username', username);
        return { success: true, username };
      }
      if (status === 'expired') {
        return { success: false, error: 'Authorization code expired. Please try again.' };
      }
    } catch { /* keep polling */ }
  }

  return { success: false, error: 'Authorization timed out after 5 minutes.' };
}

export async function logout(): Promise<void> {
  const token = getKey('opencern-token');
  if (token) {
    try {
      await (await getAxios()).post(`${CLI_AUTH_BASE}/auth/cli/revoke`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      });
    } catch { /* local logout still works */ }
  }
  deleteKey('opencern-token');
  deleteKey('opencern-username');
}

export function getUsername(): string | null {
  return getKey('opencern-username');
}
