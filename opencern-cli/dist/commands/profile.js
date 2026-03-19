// SPDX-License-Identifier: MIT
// Copyright (c) 2026 OpenCERN Contributors
import { getKey, setKey, hasKey } from '../utils/keystore.js';
import { isAuthenticated } from '../utils/auth.js';
import { config } from '../utils/config.js';
export function getProfile() {
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
export function setProfileField(key, value) {
    const fieldMap = {
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
export function formatProfile() {
    const p = getProfile();
    const ok = '[+]';
    const na = '[-]';
    const lines = [
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
export function exportProfile() {
    const p = getProfile();
    return JSON.stringify({
        username: p.username,
        displayName: p.displayName,
        email: p.email,
        org: p.org,
        defaultModel: p.defaultModel,
        dataDir: p.dataDir,
    }, null, 2);
}
//# sourceMappingURL=profile.js.map