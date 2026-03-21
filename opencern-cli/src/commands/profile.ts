// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors

import { getKey, setKey, hasKey, maskKey } from '../utils/keystore.js';
import { isAuthenticated } from '../utils/auth.js';
import { config } from '../utils/config.js';

export interface ProfileData {
  username: string | null;
  displayName: string | null;
  email: string | null;
  org: string | null;
  authenticated: boolean;
  anthropicKey: boolean;
  ibmQuantumKey: boolean;
  defaultModel: string;
  dataDir: string;
}

export function getProfile(): ProfileData {
  return {
    username: getKey('opencern-username'),
    displayName: getKey('opencern-display-name'),
    email: getKey('opencern-email'),
    org: getKey('opencern-org'),
    authenticated: isAuthenticated(),
    anthropicKey: hasKey('anthropic'),
    ibmQuantumKey: hasKey('ibm-quantum'),
    defaultModel: config.get('defaultModel'),
    dataDir: config.get('dataDir'),
  };
}

export function setProfileField(
  key: string,
  value: string,
): { success: boolean; message: string } {
  const fieldMap: Record<string, string> = {
    name: 'opencern-display-name',
    'display-name': 'opencern-display-name',
    email: 'opencern-email',
    org: 'opencern-org',
    organization: 'opencern-org',
  };

  const storeKey = fieldMap[key.toLowerCase()];
  if (!storeKey) {
    return {
      success: false,
      message: `Unknown profile field: ${key}. Available: name, email, org`,
    };
  }

  setKey(storeKey, value);
  return { success: true, message: `Profile ${key} set to "${value}"` };
}

export function formatProfile(): string[] {
  const p = getProfile();
  const ok = '[+]';
  const na = '[-]';

  const lines: string[] = [
    '',
    '  Profile',
    '  ────────────────────────────────────────',
    `  Username        ${p.username || 'not set'}`,
    `  Display Name    ${p.displayName || 'not set'}`,
    `  Email           ${p.email || 'not set'}`,
    `  Organization    ${p.org || 'not set'}`,
    '',
    '  Status',
    '  ────────────────────────────────────────',
    `  ${p.authenticated ? ok : na} Auth           ${p.authenticated ? 'signed in' : 'not signed in'}`,
    `  ${p.anthropicKey ? ok : na} Anthropic Key  ${p.anthropicKey ? 'configured' : 'not set'}`,
    `  ${p.ibmQuantumKey ? ok : na} IBM Quantum    ${p.ibmQuantumKey ? 'configured' : 'not set'}`,
    '',
    '  Preferences',
    '  ────────────────────────────────────────',
    `  Model           ${p.defaultModel}`,
    `  Data Directory  ${p.dataDir}`,
    '',
    '  Set fields:  /profile set name <value>',
    '               /profile set email <value>',
    '               /profile set org <value>',
    '',
  ];

  return lines;
}

export function exportProfile(): string {
  const p = getProfile();
  return JSON.stringify(
    {
      username: p.username,
      displayName: p.displayName,
      email: p.email,
      org: p.org,
      defaultModel: p.defaultModel,
      dataDir: p.dataDir,
    },
    null,
    2,
  );
}
