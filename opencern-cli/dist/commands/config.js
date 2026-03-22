/**
 * Copyright (c) 2026 OpenCERN. All Rights Reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL — Enterprise Component
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 * See LICENSE.enterprise for full terms.
 */
import { setKey, getKey, hasKey, maskKey, deleteKey } from '../utils/keystore.js';
import { config } from '../utils/config.js';
// Lazy-load axios to avoid follow-redirects initialization issues with Bun
const getAxios = () => import('axios').then(m => m.default);
export function getConfigItems() {
    return [
        {
            key: 'anthropic-key',
            label: 'Anthropic API Key',
            description: 'Required for /ask and /opask AI analysis',
            type: 'secret',
            required: true,
            current: hasKey('anthropic') ? maskKey(getKey('anthropic') || '') : 'Not set',
        },
        {
            key: 'ibm-quantum-key',
            label: 'IBM Quantum API Key',
            description: 'Optional -- for real quantum hardware via IBM',
            type: 'secret',
            required: false,
            current: hasKey('ibm-quantum') ? maskKey(getKey('ibm-quantum') || '') : 'Not set',
        },
        {
            key: 'defaultModel',
            label: 'Default AI Model',
            description: 'Claude model for analysis',
            type: 'choice',
            choices: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
            current: config.get('defaultModel'),
        },
        {
            key: 'quantumBackend',
            label: 'Quantum Backend',
            description: 'Default quantum computing backend',
            type: 'choice',
            choices: ['local', 'ibm', 'braket'],
            current: config.get('quantumBackend'),
        },
        {
            key: 'dataDir',
            label: 'Data Directory',
            description: 'Where downloaded datasets are stored',
            type: 'string',
            current: config.get('dataDir'),
        },
        {
            key: 'autoStartDocker',
            label: 'Auto-start Docker',
            description: 'Automatically start containers on launch',
            type: 'boolean',
            current: String(config.get('autoStartDocker')),
        },
        {
            key: 'apiBaseUrl',
            label: 'API Base URL',
            description: 'OpenCERN API endpoint (default: http://localhost:8080)',
            type: 'string',
            current: config.get('apiBaseUrl'),
        },
    ];
}
export async function setConfigValue(key, value) {
    switch (key) {
        case 'anthropic-key': {
            try {
                const axios = await getAxios();
                await axios.get('https://api.anthropic.com/v1/models', {
                    headers: { 'x-api-key': value, 'anthropic-version': '2023-06-01' },
                    timeout: 8000,
                });
            }
            catch (err) {
                const axios = await getAxios();
                if (axios.isAxiosError(err) && err.response?.status === 401) {
                    return { success: false, error: 'Invalid Anthropic API key' };
                }
                // Accept anyway on network error
            }
            setKey('anthropic', value);
            return { success: true };
        }
        case 'ibm-quantum-key':
            setKey('ibm-quantum', value);
            return { success: true };
        case 'defaultModel':
            config.set('defaultModel', value);
            return { success: true };
        case 'quantumBackend':
            config.set('quantumBackend', value);
            return { success: true };
        case 'dataDir':
            config.set('dataDir', value);
            return { success: true };
        case 'apiBaseUrl':
            config.set('apiBaseUrl', value);
            return { success: true };
        case 'autoStartDocker':
            config.set('autoStartDocker', value === 'true' || value === 'yes' || value === '1');
            return { success: true };
        default:
            return { success: false, error: `Unknown config key: ${key}` };
    }
}
export function showConfig() {
    const items = getConfigItems();
    const lines = [
        '',
        '  Configuration',
        '  ────────────────────────────────────────',
    ];
    for (const item of items) {
        lines.push(`  ${item.label.padEnd(25)} ${item.current || 'Not set'}`);
    }
    lines.push('');
    return lines;
}
export function resetConfig() {
    config.reset();
}
// ─── Key Management ──────────────────────────────────────────────────
export function getKeyStatus() {
    const lines = [
        '',
        '  API Keys',
        '  ────────────────────────────────────────',
    ];
    const keys = [
        { name: 'Anthropic', service: 'anthropic' },
        { name: 'IBM Quantum', service: 'ibm-quantum' },
        { name: 'OpenCERN Token', service: 'opencern-token' },
    ];
    for (const k of keys) {
        const set = hasKey(k.service);
        const status = set ? maskKey(getKey(k.service) || '') : 'not configured';
        const indicator = set ? '[+]' : '[-]';
        lines.push(`  ${indicator} ${k.name.padEnd(20)} ${status}`);
    }
    lines.push('');
    lines.push('  Set keys:  /keys set anthropic <key>');
    lines.push('             /keys set ibm-quantum <key>');
    lines.push('  Remove:    /keys remove anthropic');
    lines.push('');
    return lines;
}
export function setApiKey(provider, key) {
    const providerMap = {
        'anthropic': 'anthropic',
        'ibm': 'ibm-quantum',
        'ibm-quantum': 'ibm-quantum',
        'ibmq': 'ibm-quantum',
    };
    const service = providerMap[provider.toLowerCase()];
    if (!service) {
        return { success: false, message: `Unknown provider: ${provider}. Use: anthropic, ibm-quantum` };
    }
    setKey(service, key);
    const displayName = service === 'anthropic' ? 'Anthropic' : 'IBM Quantum';
    return { success: true, message: `${displayName} API key stored securely.` };
}
export function removeApiKey(provider) {
    const providerMap = {
        'anthropic': 'anthropic',
        'ibm': 'ibm-quantum',
        'ibm-quantum': 'ibm-quantum',
        'ibmq': 'ibm-quantum',
    };
    const service = providerMap[provider.toLowerCase()];
    if (!service) {
        return { success: false, message: `Unknown provider: ${provider}. Use: anthropic, ibm-quantum` };
    }
    deleteKey(service);
    const displayName = service === 'anthropic' ? 'Anthropic' : 'IBM Quantum';
    return { success: true, message: `${displayName} API key removed.` };
}
//# sourceMappingURL=config.js.map